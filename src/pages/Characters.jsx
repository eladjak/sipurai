import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@/components/i18n/i18nProvider';
import { Character } from '@/entities/Character';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Users2,
  Plus,
  Search,
  User,
  Sparkles,
  Grid3x3,
  List
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

export default function Characters() {
  const { t, isRTL } = useI18n();
  const { user } = useCurrentUser();
  const [characters, setCharacters] = useState([]);
  const [filteredCharacters, setFilteredCharacters] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState("grid");
  const [filters, setFilters] = useState({
    gender: "all",
    artStyle: "all"
  });

  useEffect(() => {
    loadCharacters();
  }, []);

  useEffect(() => {
    filterCharacters();
  }, [characters, searchQuery, filters]);

  const loadCharacters = async () => {
    try {
      setIsLoading(true);
      const data = await Character.list("-created_date");
      // Filter to only show current user's characters (privacy)
      const userChars = user?.email
        ? data.filter(c => c.created_by === user.email)
        : [];
      setCharacters(userChars);
    } catch (error) {
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const filterCharacters = () => {
    let results = [...characters];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      results = results.filter(character => 
        character.name.toLowerCase().includes(query) ||
        character.personality?.toLowerCase().includes(query) ||
        character.appearance?.toLowerCase().includes(query)
      );
    }

    if (filters.gender !== "all") {
      results = results.filter(character => character.gender === filters.gender);
    }

    if (filters.artStyle !== "all") {
      results = results.filter(character => character.art_style === filters.artStyle);
    }

    setFilteredCharacters(results);
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const artStyleOptions = [
    { value: "all", label: t("characters.allStyles") },
    { value: "cartoon", label: t("characters.artStyles.cartoon") },
    { value: "disney", label: t("characters.artStyles.disney") },
    { value: "pixar", label: t("characters.artStyles.pixar") },
    { value: "watercolor", label: t("characters.artStyles.watercolor") },
    { value: "sketch", label: t("characters.artStyles.sketch") },
    { value: "realistic", label: t("characters.artStyles.realistic") },
    { value: "anime", label: t("characters.artStyles.anime") },
    { value: "comic", label: t("characters.artStyles.comic") },
    { value: "storybook", label: t("characters.artStyles.storybook") },
    { value: "impressionist", label: t("characters.artStyles.impressionist") },
    { value: "fantasy", label: t("characters.artStyles.fantasy") },
    { value: "pop_art", label: t("characters.artStyles.popArt") },
    { value: "crayon", label: t("characters.artStyles.crayon") },
    { value: "collage", label: t("characters.artStyles.collage") },
    { value: "gouache", label: t("characters.artStyles.gouache") },
    { value: "chibi", label: t("characters.artStyles.chibi") }
  ];

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto p-4 md:p-6" dir={isRTL ? "rtl" : "ltr"} aria-busy="true" role="status">
        {/* Header skeleton */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-10 w-40" />
        </div>

        {/* Search bar skeleton */}
        <div className="mb-6">
          <Skeleton className="h-10 w-full max-w-sm" />
        </div>

        {/* Character card skeletons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {Array(8).fill(0).map((_, index) => (
            <Card key={index} className="overflow-hidden">
              <div className="flex flex-col items-center p-4 pb-2">
                <Skeleton className="h-20 w-20 rounded-full mb-3" />
                <Skeleton className="h-5 w-28 mb-1" />
                <Skeleton className="h-3 w-20 mb-2" />
                <div className="flex gap-1 mb-2">
                  <Skeleton className="h-5 w-14 rounded-full" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
              </div>
              <CardContent className="pt-0 pb-4 px-4">
                <Skeleton className="h-4 w-full mb-1" />
                <Skeleton className="h-4 w-5/6" />
              </CardContent>
            </Card>
          ))}
        </div>
        <span className="sr-only">{t("characters.loadingAria")}</span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6" dir={isRTL ? "rtl" : "ltr"}>
      {/* Header banner with image */}
      <div className="relative mb-8 rounded-2xl overflow-hidden bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 p-6 md:p-8 shadow-lg">
        <div className="absolute inset-0 bg-[url('/images/character-workshop.jpg')] bg-cover bg-center opacity-15" />
        <div className={`relative flex flex-col md:flex-row md:items-center justify-between gap-4 ${isRTL ? 'md:flex-row-reverse' : ''}`}>
          <div className={isRTL ? 'text-right' : ''}>
            <h1 className="text-3xl font-bold text-white drop-shadow-sm">{t("characters.title")}</h1>
            <p className="text-purple-100 mt-1">
              {t("characters.subtitle")}
            </p>
          </div>
          <Link to={createPageUrl("CharacterEditor")}>
            <Button className={`bg-white text-purple-700 hover:bg-purple-50 shadow-md ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Plus className="me-2 h-4 w-4" />
              {t("characters.createNew")}
            </Button>
          </Link>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4`} />
            <Input
              placeholder={t("characters.search")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`${isRTL ? 'pr-9' : 'pl-9'}`}
            />
          </div>
          
          <div className="flex gap-3">
            <Select value={filters.gender} onValueChange={(value) => handleFilterChange("gender", value)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder={t("characters.allGenders")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("characters.allGenders")}</SelectItem>
                <SelectItem value="boy">{t("characters.boy")}</SelectItem>
                <SelectItem value="girl">{t("characters.girl")}</SelectItem>
                <SelectItem value="neutral">{t("characters.neutral")}</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.artStyle} onValueChange={(value) => handleFilterChange("artStyle", value)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder={t("characters.allStyles")} />
              </SelectTrigger>
              <SelectContent>
                {artStyleOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Results count and view toggle */}
        <div className="flex justify-between items-center">
          <p className="text-sm text-gray-500">
            {filteredCharacters.length} {filteredCharacters.length === 1 ? t("characters.characterFound") : t("characters.charactersFound")}
          </p>
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-md p-1">
            <Button
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("grid")}
              className="h-8 w-8 p-0"
              aria-label="Grid view"
            >
              <Grid3x3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="h-8 w-8 p-0"
              aria-label="List view"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Characters Display */}
      {loadError ? (
        <Card className="border-dashed border-red-200 dark:border-red-900/50 bg-gradient-to-br from-red-50 to-orange-50 dark:from-gray-800/50 dark:to-gray-800/30">
          <CardContent className="p-10 md:p-16 text-center flex flex-col items-center">
            <div className="rounded-full bg-red-100 dark:bg-red-900/30 p-5 mb-6">
              <Users2 className="h-12 w-12 text-red-400" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
              {t("common.loadError")}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-md mx-auto text-base leading-relaxed">
              {t("common.tryAgain")}
            </p>
            <Button size="lg" onClick={() => { setLoadError(false); loadCharacters(); }} className="bg-purple-600 hover:bg-purple-700">
              {t("common.retry")}
            </Button>
          </CardContent>
        </Card>
      ) : filteredCharacters.length === 0 ? (
        <Card className="border-dashed border-purple-200 dark:border-gray-700 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-gray-800/50 dark:to-gray-800/30">
          <CardContent className="p-10 md:p-16 text-center flex flex-col items-center">
            <div className="rounded-full bg-purple-100 dark:bg-purple-900/30 p-5 mb-6">
              <Users2 className="h-12 w-12 text-purple-400" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
              {characters.length === 0 ? t("characters.noCharacters") : t("characters.noResults")}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-md mx-auto text-base leading-relaxed">
              {characters.length === 0 ? t("characters.createFirst") : t("characters.adjustFilters")}
            </p>
            <Link to={createPageUrl("CharacterEditor")}>
              <Button size="lg" className="bg-purple-600 hover:bg-purple-700 text-base px-8 py-3 h-auto">
                <Sparkles className="me-2 h-5 w-5" />
                {t("characters.createNew")}
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredCharacters.map((character) => (
            <Card key={character.id} className="overflow-hidden hover:shadow-xl transition-all duration-200 border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700 hover:-translate-y-1 group">
              <CardContent className="p-4">
                <div className="text-center">
                  <Avatar className="h-20 w-20 mx-auto mb-3 border-4 border-purple-100 dark:border-purple-900 group-hover:border-purple-300 dark:group-hover:border-purple-700 transition-colors duration-200 shadow-md">
                    <AvatarImage src={character.primary_image_url} alt={character.name} />
                    <AvatarFallback className="bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300 text-lg">
                      <User className="h-8 w-8" />
                    </AvatarFallback>
                  </Avatar>
                  
                  <h3 className="font-bold text-lg mb-2">{character.name}</h3>
                  
                  <div className="flex flex-wrap gap-1 justify-center mb-3">
                    {character.age && (
                      <Badge variant="outline" className="text-xs">
                        {character.age} {t("characters.years")}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs capitalize">
                      {character.gender}
                    </Badge>
                    <Badge variant="outline" className="text-xs capitalize">
                      {character.art_style}
                    </Badge>
                  </div>
                  
                  {character.personality && (
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 line-clamp-2">
                      {character.personality.substring(0, 100)}...
                    </p>
                  )}
                  
                  <Link to={`${createPageUrl("CharacterEditor")}?id=${character.id}`}>
                    <Button variant="outline" size="sm" className="w-full">
                      {t("characters.edit")}
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredCharacters.map((character) => (
            <Card key={character.id} className="hover:shadow-md transition-all duration-300">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16 border-2 border-purple-100 dark:border-purple-900">
                    <AvatarImage src={character.primary_image_url} alt={character.name} />
                    <AvatarFallback className="bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300">
                      <User className="h-6 w-6" />
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-lg mb-1">{character.name}</h3>
                        <div className="flex flex-wrap gap-2 mb-2">
                          {character.age && (
                            <Badge variant="outline" className="text-xs">
                              {character.age} {t("characters.years")}
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs capitalize">
                            {character.gender}
                          </Badge>
                          <Badge variant="outline" className="text-xs capitalize">
                            {character.art_style}
                          </Badge>
                        </div>
                        
                        {character.personality && (
                          <div className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                            <span className="font-medium">{t("characters.personality")}:</span> {character.personality.substring(0, 150)}...
                          </div>
                        )}
                        
                        {character.appearance && (
                          <div className="text-sm text-gray-600 dark:text-gray-300">
                            <span className="font-medium">{t("characters.appearance")}:</span> {character.appearance.substring(0, 150)}...
                          </div>
                        )}
                      </div>
                      
                      <Link to={`${createPageUrl("CharacterEditor")}?id=${character.id}`}>
                        <Button variant="outline" size="sm">
                          {t("characters.edit")}
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}