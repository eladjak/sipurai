import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useI18n } from '@/components/i18n/i18nProvider';
import { Character } from '@/entities/Character';
import useGamification from '@/hooks/useGamification';
import { GenerateImage, InvokeLLM } from '@/integrations/Core';
import { buildSafetyPromptPrefix } from '@/utils/content-moderation';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Loader2, Sparkles, Wand2, User, Save, ArrowLeft, Trash2, Eye, Palette, Star } from 'lucide-react';
import { motion } from 'framer-motion';

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.35, ease: "easeOut" }
  })
};

export default function CharacterEditor() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { toast } = useToast();
    const { t, isRTL } = useI18n();
    const gamification = useGamification();

    const [character, setCharacter] = useState({
        id: null,
        name: '',
        gender: 'neutral',
        age: 5,
        personality: '',
        appearance: '',
        art_style: 'cartoon',
        primary_image_url: ''
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);
    const [isGeneratingDetails, setIsGeneratingDetails] = useState(false);

    useEffect(() => {
        const id = searchParams.get('id');
        const name = searchParams.get('name');
        const data = searchParams.get('data');

        const loadCharacter = async (characterId) => {
            try {
                const fetchedCharacter = await Character.get(characterId);
                setCharacter(fetchedCharacter);
            } catch (error) {
                toast({
                    title: t("characterEditor.errorLoad"),
                    variant: "destructive",
                });
                // Redirect to Characters list — don't show blank create form
                navigate(createPageUrl("Characters"));
                return;
            } finally {
                setIsLoading(false);
            }
        };

        if (id) {
            loadCharacter(id);
        } else if (data) {
            try {
                const parsedData = JSON.parse(decodeURIComponent(data));
                setCharacter(prev => ({ ...prev, ...parsedData }));
            } catch (error) {
                // silently handled
            } finally {
                setIsLoading(false);
            }
        } else if (name) {
            setCharacter(prev => ({ ...prev, name: decodeURIComponent(name) }));
            setIsLoading(false);
        } else {
            setIsLoading(false);
        }
    }, [searchParams]);

    const handleInputChange = (field, value) => {
        setCharacter(prev => ({ ...prev, [field]: value }));
    };

    const generateCharacterImage = useCallback(async () => {
        setIsGeneratingImage(true);
        try {
            const safetyPrefix = buildSafetyPromptPrefix('5-10');
            const prompt = safetyPrefix + `A ${character.gender === 'boy' ? 'boy' : character.gender === 'girl' ? 'girl' : 'child'} character named ${character.name}, age ${character.age}, with ${character.appearance}. Style: ${character.art_style}. Child-friendly, wholesome illustration.`;
            const response = await GenerateImage({
                prompt: prompt,
                quality: 'standard',
                size: '1024x1024'
            });
            const imageUrl = typeof response === 'string' ? response : response.url;
            setCharacter(prev => ({ ...prev, primary_image_url: imageUrl }));
            toast({
                title: t("characterEditor.imageGenerated"),
                description: t("characterEditor.imageGeneratedDesc"),
            });
        } catch (error) {
            toast({
                variant: "destructive",
                title: t("characterEditor.imageGenerateFailed"),
                description: t("characterEditor.tryAgain"),
            });
        } finally {
            setIsGeneratingImage(false);
        }
    }, [character]);

    const generateCharacterDetails = useCallback(async () => {
        setIsGeneratingDetails(true);
        try {
            const safetyPrefix = buildSafetyPromptPrefix('5-10');
            const prompt = safetyPrefix + `Generate a name, age (a number between 4 and 10), gender (boy/girl/neutral), personality, and appearance for a fictional child character. Focus on positive, child-friendly traits. Provide the output as a JSON object with keys: "name", "age", "gender", "personality", "appearance". Example: {"name": "Lily", "age": 7, "gender": "girl", "personality": "Brave and adventurous, loves to explore.", "appearance": "Long brown hair, big blue eyes, wears a red dress."}`;

            const parsedDetails = await InvokeLLM({
                prompt: prompt,
                temperature: 0.7,
                max_tokens: 500,
                response_json_schema: {
                    type: "object",
                    properties: {
                        name: { type: "string" },
                        age: { type: "number" },
                        gender: { type: "string" },
                        personality: { type: "string" },
                        appearance: { type: "string" }
                    }
                }
            });
            setCharacter(prev => ({
                ...prev,
                name: parsedDetails.name || prev.name,
                age: parsedDetails.age || prev.age,
                gender: parsedDetails.gender || prev.gender,
                personality: parsedDetails.personality || prev.personality,
                appearance: parsedDetails.appearance || prev.appearance,
            }));
            toast({
                title: t("characterEditor.detailsGenerated"),
                description: t("characterEditor.detailsGeneratedDesc"),
            });
        } catch (error) {
            toast({
                variant: "destructive",
                title: t("characterEditor.detailsGenerateFailed"),
                description: t("characterEditor.tryAgain"),
            });
        } finally {
            setIsGeneratingDetails(false);
        }
    }, []);

    const handleSave = async () => {
        if (!character.name || !character.personality || !character.appearance) {
             toast({
                 variant: "destructive",
                 title: t("characterEditor.missingInfo"),
                 description: t("characterEditor.missingFields")
             });
             return;
        }

        setIsSaving(true);
        try {
            const isNewCharacter = character.id === null;
            if (isNewCharacter) {
                const newCharacter = await Character.create(character);
                toast({ title: t("characterEditor.successCreate") });
                gamification.awardXP("character_created");
                gamification.incrementStat("totalCharacters");
                setCharacter(prev => ({ ...prev, id: newCharacter.id }));
                navigate(`${createPageUrl('CharacterEditor')}?id=${newCharacter.id}`);
            } else {
                await Character.update(character.id, character);
                toast({ title: t("characterEditor.successUpdate") });
            }
        } catch (error) {
            toast({
                variant: "destructive",
                title: (character.id === null) ? t("characterEditor.errorCreate") : t("characterEditor.errorUpdate")
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            await Character.delete(character.id);
            toast({ title: t("characterEditor.successDelete") });
            navigate(createPageUrl('Characters'));
        } catch (error) {
            toast({
                variant: "destructive",
                title: t("characterEditor.errorDelete")
            });
        } finally {
            setIsDeleting(false);
        }
    };

    const isNew = character.id === null;

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-dvh">
                <Loader2 className="h-10 w-10 animate-spin text-purple-600" />
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto" dir={isRTL ? "rtl" : "ltr"}>

            {/* Gradient header banner */}
            <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="relative mb-6 md:mb-8 rounded-b-3xl overflow-hidden bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 px-4 md:px-8 pt-6 pb-8 shadow-lg mx-0"
            >
                {/* Subtle background texture */}
                <div className="absolute inset-0 bg-[url('/images/character-workshop.jpg')] bg-cover bg-center opacity-10" />
                <div className={`relative flex flex-col md:flex-row md:items-center justify-between gap-4 ${isRTL ? 'md:flex-row-reverse' : ''}`}>
                    <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <button
                            onClick={() => navigate(createPageUrl('Characters'))}
                            className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/20 hover:bg-white/30 transition-colors text-white"
                            aria-label={t("characterEditor.back")}
                        >
                            <ArrowLeft className={`h-5 w-5 ${isRTL ? 'rotate-180' : ''}`} />
                        </button>
                        <div className={isRTL ? 'text-right' : ''}>
                            <h1 className="text-2xl md:text-3xl font-bold text-white drop-shadow-sm">
                                {isNew ? t("characterEditor.createNew") : t("characterEditor.editCharacter")}
                            </h1>
                            {!isNew && character.name && (
                                <p className="text-purple-100 mt-0.5 text-sm">{character.name}</p>
                            )}
                        </div>
                    </div>

                    {/* AI generate details CTA in header */}
                    <Button
                        onClick={generateCharacterDetails}
                        disabled={isGeneratingDetails}
                        className="bg-white text-purple-700 hover:bg-purple-50 shadow-md rounded-xl gap-2 shrink-0"
                    >
                        {isGeneratingDetails
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <Sparkles className="h-4 w-4" />
                        }
                        {t("characterEditor.generateDetails")}
                    </Button>
                </div>
            </motion.div>

            {/* Main content grid */}
            <div className="px-4 md:px-6 pb-8 grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Left column: form */}
                <div className="md:col-span-2 space-y-5">

                    {/* Basic info card */}
                    <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible">
                        <Card className="rounded-2xl shadow-sm border-0 ring-1 ring-black/5 dark:ring-white/10">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400">
                                        <User className="h-4 w-4" />
                                    </span>
                                    {t("characterEditor.basicInfo")}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <Label htmlFor="name" className={`text-sm font-medium mb-1.5 block ${isRTL ? 'text-right' : ''}`}>
                                        {t("characterEditor.name")}
                                    </Label>
                                    <Input
                                        id="name"
                                        value={character.name}
                                        onChange={(e) => handleInputChange('name', e.target.value)}
                                        className="rounded-xl"
                                        dir={isRTL ? "rtl" : "ltr"}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="age" className={`text-sm font-medium mb-1.5 block ${isRTL ? 'text-right' : ''}`}>
                                            {t("characterEditor.age")}
                                        </Label>
                                        <Input
                                            id="age"
                                            type="number"
                                            value={character.age}
                                            onChange={(e) => handleInputChange('age', e.target.valueAsNumber || '')}
                                            className="rounded-xl"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="gender" className={`text-sm font-medium mb-1.5 block ${isRTL ? 'text-right' : ''}`}>
                                            {t("characterEditor.gender")}
                                        </Label>
                                        <Select value={character.gender} onValueChange={(val) => handleInputChange('gender', val)}>
                                            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="boy">{t("characterEditor.boy")}</SelectItem>
                                                <SelectItem value="girl">{t("characterEditor.girl")}</SelectItem>
                                                <SelectItem value="neutral">{t("characterEditor.neutral")}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>

                    {/* Personality & appearance card */}
                    <motion.div custom={1} variants={fadeUp} initial="hidden" animate="visible">
                        <Card className="rounded-2xl shadow-sm border-0 ring-1 ring-black/5 dark:ring-white/10">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400">
                                        <Star className="h-4 w-4" />
                                    </span>
                                    {t("characterEditor.personalityAppearance")}
                                </CardTitle>
                                <CardDescription className={isRTL ? 'text-right' : ''}>
                                    {t("characterEditor.personalityDesc")}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <Label htmlFor="personality" className={`text-sm font-medium mb-1.5 block ${isRTL ? 'text-right' : ''}`}>
                                        {t("characterEditor.personality")}
                                    </Label>
                                    <Textarea
                                        id="personality"
                                        placeholder={t("characterEditor.personalityPlaceholder")}
                                        value={character.personality}
                                        onChange={(e) => handleInputChange('personality', e.target.value)}
                                        rows={4}
                                        className="rounded-xl resize-none"
                                        dir={isRTL ? "rtl" : "ltr"}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="appearance" className={`text-sm font-medium mb-1.5 block ${isRTL ? 'text-right' : ''}`}>
                                        {t("characterEditor.appearance")}
                                    </Label>
                                    <Textarea
                                        id="appearance"
                                        placeholder={t("characterEditor.appearancePlaceholder")}
                                        value={character.appearance}
                                        onChange={(e) => handleInputChange('appearance', e.target.value)}
                                        rows={4}
                                        className="rounded-xl resize-none"
                                        dir={isRTL ? "rtl" : "ltr"}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>

                {/* Right column: visuals + actions */}
                <div className="space-y-5">

                    {/* Character preview card */}
                    <motion.div custom={2} variants={fadeUp} initial="hidden" animate="visible">
                        <Card className="rounded-2xl shadow-sm border-0 ring-1 ring-black/5 dark:ring-white/10 overflow-hidden">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400">
                                        <Palette className="h-4 w-4" />
                                    </span>
                                    {t("characterEditor.visuals")}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Art style picker */}
                                <div>
                                    <Label htmlFor="art_style" className={`text-sm font-medium mb-1.5 block ${isRTL ? 'text-right' : ''}`}>
                                        {t("characterEditor.artStyle")}
                                    </Label>
                                    <Select value={character.art_style} onValueChange={(val) => handleInputChange('art_style', val)}>
                                        <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="cartoon">{t("characterEditor.styleCartoon")}</SelectItem>
                                            <SelectItem value="disney">{t("characterEditor.styleDisney")}</SelectItem>
                                            <SelectItem value="pixar">{t("characterEditor.stylePixar")}</SelectItem>
                                            <SelectItem value="watercolor">{t("characterEditor.styleWatercolor")}</SelectItem>
                                            <SelectItem value="sketch">{t("characterEditor.styleSketch")}</SelectItem>
                                            <SelectItem value="realistic">{t("characterEditor.styleRealistic")}</SelectItem>
                                            <SelectItem value="anime">{t("characterEditor.styleAnime")}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Character preview area */}
                                <div className="flex flex-col items-center gap-3">
                                    <div className="relative group">
                                        {/* Gradient ring around avatar */}
                                        <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-purple-400 via-violet-500 to-indigo-500 opacity-70 blur-sm group-hover:opacity-100 transition-opacity duration-300" />
                                        <div className="relative rounded-full overflow-hidden h-40 w-40 ring-2 ring-white dark:ring-gray-800 shadow-xl">
                                            {character.primary_image_url ? (
                                                <img
                                                    src={character.primary_image_url}
                                                    alt={character.name || t("characterEditor.preview")}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/40 dark:to-indigo-900/40 flex items-center justify-center">
                                                    <User className="h-20 w-20 text-purple-300 dark:text-purple-600" />
                                                </div>
                                            )}
                                        </div>
                                        {/* Shimmer overlay when generating */}
                                        {isGeneratingImage && (
                                            <div className="absolute inset-0 rounded-full overflow-hidden">
                                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[shimmer_1.5s_infinite] -translate-x-full" />
                                            </div>
                                        )}
                                    </div>

                                    {character.name && (
                                        <div className={`text-center ${isRTL ? 'text-right' : ''}`}>
                                            <p className="font-semibold text-gray-900 dark:text-white">{character.name}</p>
                                            {character.age > 0 && (
                                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                                    {character.age} · {character.gender && t(`characterEditor.${character.gender}`)}
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {/* Image URL input */}
                                    <Input
                                        placeholder={t("characterEditor.imageUrlPlaceholder")}
                                        value={character.primary_image_url}
                                        onChange={(e) => handleInputChange('primary_image_url', e.target.value)}
                                        className="rounded-xl text-xs"
                                        dir="ltr"
                                    />

                                    {/* Generate image button — shimmer / gradient CTA */}
                                    <Button
                                        onClick={generateCharacterImage}
                                        disabled={isGeneratingImage || !character.name || !character.appearance}
                                        className="w-full relative overflow-hidden rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-md gap-2 group"
                                    >
                                        {/* Shimmer sweep */}
                                        {!isGeneratingImage && (
                                            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
                                        )}
                                        {isGeneratingImage
                                            ? <Loader2 className="h-4 w-4 animate-spin" />
                                            : <Wand2 className="h-4 w-4" />
                                        }
                                        {isGeneratingImage
                                            ? t("characterEditor.generating") || "Generating..."
                                            : t("characterEditor.generateImage")
                                        }
                                    </Button>

                                    {/* View image button */}
                                    {character.primary_image_url && (
                                        <Button
                                            variant="outline"
                                            className="w-full rounded-xl gap-2"
                                            onClick={() => window.open(character.primary_image_url, '_blank', 'noopener,noreferrer')}
                                        >
                                            <Eye className="h-4 w-4" />
                                            {t("characterEditor.viewImage")}
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>

                    {/* Save / Delete actions */}
                    <motion.div custom={3} variants={fadeUp} initial="hidden" animate="visible" className="space-y-3">
                        {/* Save CTA — gradient */}
                        <Button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-md gap-2 h-11"
                        >
                            {isSaving
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : <Save className="h-4 w-4" />
                            }
                            {isNew ? t("characterEditor.createCharacter") : t("characterEditor.saveChanges")}
                        </Button>

                        {/* Delete — existing characters only */}
                        {!isNew && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button
                                        variant="outline"
                                        disabled={isDeleting}
                                        className="w-full rounded-xl border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30 gap-2"
                                    >
                                        {isDeleting
                                            ? <Loader2 className="h-4 w-4 animate-spin" />
                                            : <Trash2 className="h-4 w-4" />
                                        }
                                        {t("characterEditor.deleteCharacter")}
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="rounded-2xl">
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>{t("characterEditor.deleteCharacter")}</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            {t("characterEditor.deleteConfirm")}
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel className="rounded-xl">{t("characterEditor.cancelBtn")}</AlertDialogCancel>
                                        <AlertDialogAction
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl"
                                            onClick={handleDelete}
                                        >
                                            {t("characterEditor.deleteCharacter")}
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                    </motion.div>
                </div>
            </div>
        </div>
    );
}
