import { useRef } from 'react';
import { useQuery, useQueryClient, QueryClient } from '@tanstack/react-query';
import { Character } from '@/entities/Character';

/**
 * Hook to load saved Character entities and convert between
 * Character entity format and the bookData.selectedCharacters format.
 * Uses React Query for automatic caching and deduplication.
 */
export default function useCharacterSelector(ownerId) {
  // Use the global QueryClient from the provider when available;
  // fall back to a per-instance client for test environments.
  const fallbackRef = useRef(null);
  let queryClient;
  try {
    queryClient = useQueryClient();
  } catch {
    if (!fallbackRef.current) {
      fallbackRef.current = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    }
    queryClient = fallbackRef.current;
  }

  const { data, isPending, refetch } = useQuery(
    {
      queryKey: ['characters', ownerId],
      enabled: Boolean(ownerId),
      queryFn: async () => {
        try {
          return await Character.list('-created_date', 50);
        } catch {
          // silently handled - user may not have characters yet
          return [];
        }
      },
      staleTime: 2 * 60 * 1000, // 2 minutes
      retry: false,
    },
    queryClient
  );

  /**
   * Convert a Character entity to the format used in bookData.selectedCharacters
   */
  const entityToSelection = (entity) => ({
    id: `entity_${entity.id}`,
    entityId: entity.id,
    name: entity.name,
    traits: entity.personality || '',
    emoji: null,
    avatar: entity.primary_image_url || null,
    age: entity.age,
    gender: entity.gender,
    isTemplate: false,
    isEntity: true,
  });

  /**
   * Convert a template selection to bookData.selectedCharacters format
   */
  const templateToSelection = (template, isHebrew) => ({
    id: template.id,
    name: isHebrew ? template.he : template.en,
    traits: template.traits,
    emoji: template.emoji,
    avatar: null,
    isTemplate: true,
    isEntity: false,
  });

  return {
    savedCharacters: data ?? [],
    isLoading: isPending,
    reload: refetch,
    entityToSelection,
    templateToSelection,
  };
}
