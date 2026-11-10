# i18n audit (generated 2026-11-10T13:22:06.778Z)

**Rerun:** `cd /root/work/sipurai-ux-49eb82ff && node docs/ux-overhaul/tools/i18n-audit.mjs`
Method: Babel AST (@babel/parser + traverse from /root/work/sipurai-dash-1179515851/node_modules) for locales, t() calls, JSX text/props, ternaries and src/data. No regex-only counting.

## Control check (mandatory; passed: true)
Fixture = temp project with one Hebrew JSX string, one English JSX string, one t('missing.key'), one isHebrew ternary with literals, one English-only data field, one untranslated copy, one key missing in he and yi. Result: {"hardcodedHebrewJsxText_counted":true,"hardcodedEnglishJsxText_counted":true,"tMissingKey_detected":true,"keyMissingInHe_detected":true,"keyMissingInYi_detected":true,"untranslatedCopy_detected":true,"ternary_detected":true,"dataEnglishOnly_detected":true,"inlineEnglishContent_detected":true}; counts {"hebText":1,"enText":1,"ternary":1,"missingKeyHits":1}. The script refuses to emit numbers if any check fails.

## Locale keys
| locale | keys | keys missing vs en | value identical to en (Latin) | Latin value with no Hebrew letters |
|---|---|---|---|---|
| en | 2056 | - | - | - |
| he | 2053 | 5 | 6 | 2 |
| yi | 1929 | 129 | 4 | 2 |

Keys in he but not in en: 2. Locale eval issues: 0.
Caveat: "no Hebrew letters" also counts brand names, emails and codes (PDF, Google...); full lists are in i18n-audit.json.

Missing in he (first 15):
  - home.features.title
  - home.features.subtitle
  - onboarding.profile.age
  - onboarding.profile.name
  - onboarding.profile.namePlaceholder

Missing in yi (first 15):
  - pageTitles.home
  - pageTitles.settings
  - pageTitles.library
  - pageTitles.createbook
  - pageTitles.bookview
  - pageTitles.collaborate
  - pageTitles.feedback
  - pageTitles.community
  - pageTitles.Home
  - pageTitles.Library
  - pageTitles.Community
  - pageTitles.Settings
  - pageTitles.BookCreation
  - pageTitles.BookView
  - pageTitles.BookWizard

he values with Latin only (first 15):
  - social.notificationMessage.new_book
  - contact.emailPlaceholder

## t() usage in code (220 files; excludes locales, tests, src/components/ui)
Distinct literal keys used: 1375. Used but missing from he: 73, en: 73, yi: 146. Keys not referenced by any literal t() call (dynamic keys inflate this): he 751, en 754, yi 700.

Used but missing in he (first 30):
  - {"key":"book.autoSaving","at":"src/components/bookCreation/AutoSaveIndicator.jsx:13"}
  - {"key":"book.autoSaved","at":"src/components/bookCreation/AutoSaveIndicator.jsx:22"}
  - {"key":"book.autoSaveError","at":"src/components/bookCreation/AutoSaveIndicator.jsx:31"}
  - {"key":"book.backToLibrary","at":"src/components/bookCreation/BookEditorTab.jsx:100"}
  - {"key":"book.viewFullBook","at":"src/components/bookCreation/BookEditorTab.jsx:106"}
  - {"key":"book.layoutUpdated","at":"src/components/bookCreation/BookStylingTab.jsx:45"}
  - {"key":"book.rhymingOptions","at":"src/components/bookCreation/BookStylingTab.jsx:56"}
  - {"key":"book.rhymingDesc","at":"src/components/bookCreation/BookStylingTab.jsx:58"}
  - {"key":"book.enableRhyming","at":"src/components/bookCreation/BookStylingTab.jsx:63"}
  - {"key":"book.applyRhyming","at":"src/components/bookCreation/BookStylingTab.jsx:91"}
  - {"key":"book.createTitle","at":"src/components/bookCreation/DraftView.jsx:63"}
  - {"key":"book.readyMessage","at":"src/components/bookCreation/DraftView.jsx:66"}
  - {"key":"book.storyTitle","at":"src/components/bookCreation/DraftView.jsx:77"}
  - {"key":"book.bookSummary","at":"src/components/bookCreation/DraftView.jsx:80"}
  - {"key":"book.characterSettings","at":"src/components/bookCreation/DraftView.jsx:94"}
  - {"key":"book.characterSettingsDesc","at":"src/components/bookCreation/DraftView.jsx:96"}
  - {"key":"book.mainCharDesc","at":"src/components/bookCreation/DraftView.jsx:102"}
  - {"key":"book.mainCharPlaceholder","at":"src/components/bookCreation/DraftView.jsx:114"}
  - {"key":"book.secondaryChars","at":"src/components/bookCreation/DraftView.jsx:122"}
  - {"key":"book.name","at":"src/components/bookCreation/DraftView.jsx:135"}
  - {"key":"book.briefDesc","at":"src/components/bookCreation/DraftView.jsx:149"}
  - {"key":"book.artStyleConsistency","at":"src/components/bookCreation/DraftView.jsx:176"}
  - {"key":"book.selectArtStyle","at":"src/components/bookCreation/DraftView.jsx:188"}
  - {"key":"book.generating","at":"src/components/bookCreation/DraftView.jsx:244"}
  - {"key":"book.generateMyBook","at":"src/components/bookCreation/DraftView.jsx:249"}
  - {"key":"book.editPageImage","at":"src/components/bookCreation/PageImageEditor.jsx:38"}
  - {"key":"book.imagePrompt","at":"src/components/bookCreation/PageImageEditor.jsx:44"}
  - {"key":"book.simpleMode","at":"src/components/bookCreation/PageImageEditor.jsx:51"}
  - {"key":"book.editFullPrompt","at":"src/components/bookCreation/PageImageEditor.jsx:51"}
  - {"key":"book.imagePromptPlaceholder","at":"src/components/bookCreation/PageImageEditor.jsx:61"}

## Hard-coded user-facing strings in JSX
JSX text: Hebrew 56, English (2+ words) 26. String props (placeholder,title,aria-label,alt,label,description,subtitle,helperText): Hebrew 44, English (2+ words) 17. Language ternaries with literal strings: 127. Parse errors: 0.

Top 30 files:
| file | heb text | heb prop | en text | en prop | ternary | t() calls |
|---|---|---|---|---|---|---|
| src/components/bookCreation/ScenePlanStep.jsx | 0 | 0 | 0 | 0 | 36 | 0 |
| src/pages/AdminPrintOrders.jsx | 18 | 6 | 0 | 0 | 0 | 0 |
| src/pages/PrintCheckout.jsx | 14 | 10 | 0 | 0 | 0 | 0 |
| src/components/storyBuilder/SceneCard.jsx | 0 | 0 | 0 | 0 | 17 | 0 |
| src/components/storyBuilder/StoryStructure.jsx | 0 | 0 | 0 | 0 | 17 | 0 |
| src/components/checkout/AddressForm.jsx | 1 | 12 | 0 | 0 | 0 | 0 |
| src/components/ai/AIProvidersPanel.jsx | 0 | 0 | 0 | 3 | 7 | 0 |
| src/components/landing/FAQChat.jsx | 0 | 0 | 0 | 0 | 9 | 0 |
| src/lib/sceneGenerator.js | 0 | 0 | 0 | 0 | 8 | 0 |
| src/pages/MyOrders.jsx | 4 | 4 | 0 | 0 | 0 | 0 |
| src/components/UserNotRegisteredError.jsx | 0 | 0 | 6 | 0 | 0 | 0 |
| src/components/feedback/FeedbackList.jsx | 0 | 0 | 6 | 0 | 0 | 0 |
| src/components/feedback/FeedbackStats.jsx | 0 | 0 | 6 | 0 | 0 | 0 |
| src/pages/BookView.jsx | 0 | 2 | 0 | 2 | 2 | 51 |
| src/components/checkout/OrderCard.jsx | 5 | 0 | 0 | 0 | 0 | 0 |
| src/components/checkout/PaymentReturn.jsx | 3 | 2 | 0 | 0 | 0 | 0 |
| src/components/checkout/SummaryCard.jsx | 4 | 1 | 0 | 0 | 0 | 0 |
| src/components/feedback/FeedbackContext.jsx | 0 | 0 | 5 | 0 | 0 | 0 |
| src/pages/Pricing.jsx | 0 | 0 | 0 | 0 | 5 | 8 |
| src/pages/Settings.jsx | 0 | 0 | 0 | 0 | 5 | 64 |
| src/components/landing/FooterSection.jsx | 0 | 0 | 2 | 0 | 2 | 12 |
| src/Layout.jsx | 0 | 0 | 0 | 3 | 0 | 23 |
| src/components/ai/TextOverlay.jsx | 0 | 0 | 0 | 1 | 2 | 13 |
| src/components/bookReader/TTSControls.jsx | 0 | 3 | 0 | 0 | 0 | 12 |
| src/components/checkout/QtyStepper.jsx | 0 | 3 | 0 | 0 | 0 | 0 |
| src/components/checkout/Stepper.jsx | 2 | 1 | 0 | 0 | 0 | 0 |
| src/components/wizard/SaveStep.jsx | 0 | 0 | 0 | 0 | 3 | 16 |
| src/pages/Library.jsx | 0 | 0 | 0 | 3 | 0 | 53 |
| src/components/profile/AvatarSelector.jsx | 0 | 0 | 0 | 1 | 1 | 19 |
| src/components/shared/QuotaLimitCard.jsx | 2 | 0 | 0 | 0 | 0 | 0 |

Ternary samples:
  - src/components/ai/AIProvidersPanel.jsx:52 isRTL ? ["ספקי AI","AI Providers"]
  - src/components/ai/AIProvidersPanel.jsx:60 isRTL ? ["ספק תמונות","Image provider"]
  - src/components/ai/AIProvidersPanel.jsx:73 isRTL ? ["ההגדרה משפיעה על איורי ספרים ודמויות חדשות.","Affects new book illus
  - src/components/ai/AIProvidersPanel.jsx:81 isRTL ? ["מנוע קריינות (TTS)","Narration engine (TTS)"]
  - src/components/ai/AIProvidersPanel.jsx:97 isRTL ? ["קול","Voice"]
  - src/components/ai/AIProvidersPanel.jsx:105 isRTL ? ["ברירת מחדל לפי שפה","Default per language"]
  - src/components/ai/AIProvidersPanel.jsx:114 isRTL ? ["מנוע \"דפדפן\" עובד לוקלית בחינם אבל לעיתים רובוטי בעברית. מנועי AI 
  - src/components/ai/TextOverlay.jsx:45 isRTL ? ["Heebo","Arial"]
  - src/components/ai/TextOverlay.jsx:131 isRTL ? ["Heebo","Arial"]
  - src/components/bookCreation/ScenePlanStep.jsx:75 isHebrew ? ["תכנון סצנות הסיפור"]
  - src/components/bookCreation/ScenePlanStep.jsx:75 isYiddish ? ["פלאַנירן די סצענעס","Plan Your Scenes"]
  - src/components/bookCreation/ScenePlanStep.jsx:79 isHebrew ? ["ה-AI יבנה לך מתווה סצנה-אחר-סצנה. תוכל לערוך כל סצנה לפני שיוצרים את
  - src/components/bookCreation/ScenePlanStep.jsx:81 isYiddish ? ["די AI וועט בויען א סצענע-נאך-סצענע אַוטליין. דו קענסט רעדאַקטירן יעד
  - src/components/bookCreation/ScenePlanStep.jsx:87 isHebrew ? ["צור מתווה סצנות"]
  - src/components/bookCreation/ScenePlanStep.jsx:87 isYiddish ? ["מאַך אַ סצענע-פּלאַן","Generate Scene Plan"]
  - src/components/bookCreation/ScenePlanStep.jsx:91 isHebrew ? ["צור מחדש"]
  - src/components/bookCreation/ScenePlanStep.jsx:91 isYiddish ? ["מאַך פֿון דאָס נײַ","Regenerate plan"]
  - src/components/bookCreation/ScenePlanStep.jsx:95 isHebrew ? ["סצנה"]
  - src/components/bookCreation/ScenePlanStep.jsx:95 isYiddish ? ["סצענע","Scene"]
  - src/components/bookCreation/ScenePlanStep.jsx:99 isHebrew ? ["כותרת"]

## src/data user-facing content findings (0)
src/data holds 3 files (demoBooks, blogPosts, privacyPolicyContent). Result 0 was verified against the fixture control above and by manual check: demoBooks titles are {he,en} pairs, blogPosts are Hebrew-only, privacyPolicyContent English is the intended en branch.
  (none)

## English-only content objects OUTSIDE src/data (title/name/description/excerpt/moral/subtitle/summary/tagline/label), 123 without a Hebrew sibling key, 1 with one
  - {"file":"src/components/ErrorBoundary.jsx","line":60,"kind":"english-only-inline-content","key":"description","value":"Don't worry, this happens sometimes. Let's try again!","siblingKeys":"heading,description,tryAgain,goHome"}
  - {"file":"src/components/ai/ModelSelector.jsx","line":83,"kind":"english-only-inline-content","key":"name","value":"Gemini 2.5 Flash Image","siblingKeys":"id,name,provider,tier,speed,quality,specialties"}
  - {"file":"src/components/ai/ModelSelector.jsx","line":91,"kind":"english-only-inline-content","key":"description","value":"Sipurai's default — fast, cheap, great for kids' books","siblingKeys":"id,name,provider,tier,speed,quality,specialties"}
  - {"file":"src/components/ai/ModelSelector.jsx","line":95,"kind":"english-only-inline-content","key":"name","value":"Gemini 3 Pro Image","siblingKeys":"id,name,provider,tier,speed,quality,specialties"}
  - {"file":"src/components/ai/ModelSelector.jsx","line":103,"kind":"english-only-inline-content","key":"description","value":"Best Hebrew text fidelity, highest-quality kids' book art","siblingKeys":"id,name,provider,tier,speed,quality,specialties"}
  - {"file":"src/components/ai/ModelSelector.jsx","line":108,"kind":"english-only-inline-content","key":"name","value":"Stable Diffusion XL","siblingKeys":"id,name,provider,tier,speed,quality,specialties"}
  - {"file":"src/components/ai/ModelSelector.jsx","line":116,"kind":"english-only-inline-content","key":"description","value":"Open-source model, great for general illustrations","siblingKeys":"id,name,provider,tier,speed,quality,specialties"}
  - {"file":"src/components/ai/ModelSelector.jsx","line":120,"kind":"english-only-inline-content","key":"name","value":"GPT Image 1 (OpenAI)","siblingKeys":"id,name,provider,tier,speed,quality,specialties"}
  - {"file":"src/components/ai/ModelSelector.jsx","line":128,"kind":"english-only-inline-content","key":"description","value":"Advanced understanding of complex prompts","siblingKeys":"id,name,provider,tier,speed,quality,specialties"}
  - {"file":"src/components/ai/ModelSelector.jsx","line":134,"kind":"english-only-inline-content","key":"name","value":"Ideogram Basic","siblingKeys":"id,name,provider,tier,speed,quality,specialties"}
  - {"file":"src/components/ai/ModelSelector.jsx","line":142,"kind":"english-only-inline-content","key":"description","value":"Excellent for text integration, supports Hebrew text","siblingKeys":"id,name,provider,tier,speed,quality,specialties"}
  - {"file":"src/components/ai/ModelSelector.jsx","line":146,"kind":"english-only-inline-content","key":"name","value":"Flux Fast 1.1","siblingKeys":"id,name,provider,tier,speed,quality,specialties"}
  - {"file":"src/components/ai/ModelSelector.jsx","line":154,"kind":"english-only-inline-content","key":"description","value":"Ultra-fast generation for rapid prototyping","siblingKeys":"id,name,provider,tier,speed,quality,specialties"}
  - {"file":"src/components/ai/ModelSelector.jsx","line":158,"kind":"english-only-inline-content","key":"name","value":"Flux Kontext Fast","siblingKeys":"id,name,provider,tier,speed,quality,specialties"}
  - {"file":"src/components/ai/ModelSelector.jsx","line":166,"kind":"english-only-inline-content","key":"description","value":"Fast context-aware generation with good consistency","siblingKeys":"id,name,provider,tier,speed,quality,specialties"}
  - {"file":"src/components/ai/ModelSelector.jsx","line":178,"kind":"english-only-inline-content","key":"description","value":"Google's latest fast image generation model","siblingKeys":"id,name,provider,tier,speed,quality,specialties"}
  - {"file":"src/components/ai/ModelSelector.jsx","line":182,"kind":"english-only-inline-content","key":"name","value":"Luma Photon Flash","siblingKeys":"id,name,provider,tier,speed,quality,specialties"}
  - {"file":"src/components/ai/ModelSelector.jsx","line":190,"kind":"english-only-inline-content","key":"description","value":"Fastest generation for real-time applications","siblingKeys":"id,name,provider,tier,speed,quality,specialties"}
  - {"file":"src/components/ai/ModelSelector.jsx","line":196,"kind":"english-only-inline-content","key":"name","value":"Flux Kontext Pro","siblingKeys":"id,name,provider,tier,speed,quality,specialties"}
  - {"file":"src/components/ai/ModelSelector.jsx","line":204,"kind":"english-only-inline-content","key":"description","value":"Professional-grade context understanding and consistency","siblingKeys":"id,name,provider,tier,speed,quality,specialties"}
  - {"file":"src/components/ai/ModelSelector.jsx","line":208,"kind":"english-only-inline-content","key":"name","value":"Flux Pro","siblingKeys":"id,name,provider,tier,speed,quality,specialties"}
  - {"file":"src/components/ai/ModelSelector.jsx","line":216,"kind":"english-only-inline-content","key":"description","value":"Top-tier quality for professional applications","siblingKeys":"id,name,provider,tier,speed,quality,specialties"}
  - {"file":"src/components/ai/ModelSelector.jsx","line":228,"kind":"english-only-inline-content","key":"description","value":"Advanced text integration with professional typography","siblingKeys":"id,name,provider,tier,speed,quality,specialties"}
  - {"file":"src/components/ai/ModelSelector.jsx","line":240,"kind":"english-only-inline-content","key":"description","value":"Google's flagship photorealistic generation","siblingKeys":"id,name,provider,tier,speed,quality,specialties"}
  - {"file":"src/components/ai/ModelSelector.jsx","line":244,"kind":"english-only-inline-content","key":"name","value":"Leonardo Phoenix","siblingKeys":"id,name,provider,tier,speed,quality,specialties"}
  - {"file":"src/components/ai/ModelSelector.jsx","line":252,"kind":"english-only-inline-content","key":"description","value":"Specialized in artistic and character illustration","siblingKeys":"id,name,provider,tier,speed,quality,specialties"}
  - {"file":"src/components/ai/ModelSelector.jsx","line":256,"kind":"english-only-inline-content","key":"name","value":"Luma Photon","siblingKeys":"id,name,provider,tier,speed,quality,specialties"}
  - {"file":"src/components/ai/ModelSelector.jsx","line":264,"kind":"english-only-inline-content","key":"description","value":"Professional photography-grade generation","siblingKeys":"id,name,provider,tier,speed,quality,specialties"}
  - {"file":"src/components/ai/ModelSelector.jsx","line":278,"kind":"english-only-inline-content","key":"description","value":"DALL-E 3 at maximum resolution and quality","siblingKeys":"id,name,provider,tier,speed,quality,specialties"}
  - {"file":"src/components/ai/ModelSelector.jsx","line":282,"kind":"english-only-inline-content","key":"name","value":"Flux Kontext Max","siblingKeys":"id,name,provider,tier,speed,quality,specialties"}
  - {"file":"src/components/ai/ModelSelector.jsx","line":290,"kind":"english-only-inline-content","key":"description","value":"Maximum context understanding for complex series","siblingKeys":"id,name,provider,tier,speed,quality,specialties"}
  - {"file":"src/components/ai/ModelSelector.jsx","line":294,"kind":"english-only-inline-content","key":"name","value":"Flux Ultra","siblingKeys":"id,name,provider,tier,speed,quality,specialties"}
  - {"file":"src/components/ai/ModelSelector.jsx","line":302,"kind":"english-only-inline-content","key":"description","value":"Ultra-high quality for cinema and professional use","siblingKeys":"id,name,provider,tier,speed,quality,specialties"}
  - {"file":"src/components/ai/ModelSelector.jsx","line":306,"kind":"english-only-inline-content","key":"name","value":"GPT Image","siblingKeys":"id,name,provider,tier,speed,quality,specialties"}
  - {"file":"src/components/ai/ModelSelector.jsx","line":314,"kind":"english-only-inline-content","key":"description","value":"GPT-powered image generation with conversational interface","siblingKeys":"id,name,provider,tier,speed,quality,specialties"}
  - {"file":"src/components/ai/ModelSelector.jsx","line":318,"kind":"english-only-inline-content","key":"name","value":"GPT Image Fast","siblingKeys":"id,name,provider,tier,speed,quality,specialties"}
  - {"file":"src/components/ai/ModelSelector.jsx","line":326,"kind":"english-only-inline-content","key":"description","value":"Fast GPT-powered generation for quick iterations","siblingKeys":"id,name,provider,tier,speed,quality,specialties"}
  - {"file":"src/components/ai/ModelSelector.jsx","line":338,"kind":"english-only-inline-content","key":"description","value":"Perfect text integration in any language","siblingKeys":"id,name,provider,tier,speed,quality,specialties"}
  - {"file":"src/components/ai/ModelSelector.jsx","line":350,"kind":"english-only-inline-content","key":"description","value":"Professional brand and vector art generation","siblingKeys":"id,name,provider,tier,speed,quality,specialties"}
  - {"file":"src/components/ai/ModelSelector.jsx","line":354,"kind":"english-only-inline-content","key":"name","value":"Recraft Realistic","siblingKeys":"id,name,provider,tier,speed,quality,specialties"}
  - {"file":"src/components/ai/ModelSelector.jsx","line":362,"kind":"english-only-inline-content","key":"description","value":"Ultra-realistic commercial photography generation","siblingKeys":"id,name,provider,tier,speed,quality,specialties"}
  - {"file":"src/components/ai/ModelSelector.jsx","line":369,"kind":"english-only-inline-content","key":"name","value":"Stable Video Diffusion","siblingKeys":"id,name,provider,tier,speed,quality,specialties"}
  - {"file":"src/components/ai/ModelSelector.jsx","line":377,"kind":"english-only-inline-content","key":"description","value":"Animates a still image into a short video clip.","siblingKeys":"id,name,provider,tier,speed,quality,specialties"}
  - {"file":"src/components/ai/ModelSelector.jsx","line":382,"kind":"english-only-inline-content","key":"name","value":"Pika Labs","siblingKeys":"id,name,provider,tier,speed,quality,specialties"}
  - {"file":"src/components/ai/ModelSelector.jsx","line":390,"kind":"english-only-inline-content","key":"description","value":"Generates high-quality video clips from text prompts.","siblingKeys":"id,name,provider,tier,speed,quality,specialties"}
  - {"file":"src/components/ai/ModelSelector.jsx","line":394,"kind":"english-only-inline-content","key":"name","value":"Luma Dream Machine","siblingKeys":"id,name,provider,tier,speed,quality,specialties"}
  - {"file":"src/components/ai/ModelSelector.jsx","line":402,"kind":"english-only-inline-content","key":"description","value":"State-of-the-art model for creating realistic and consistent video cli","siblingKeys":"id,name,provider,tier,speed,quality,specialties"}
  - {"file":"src/components/ai/ModelSelector.jsx","line":407,"kind":"english-only-inline-content","key":"name","value":"Runway Gen-3","siblingKeys":"id,name,provider,tier,speed,quality,specialties"}
  - {"file":"src/components/ai/ModelSelector.jsx","line":415,"kind":"english-only-inline-content","key":"description","value":"Professional-grade video generation with advanced controls.","siblingKeys":"id,name,provider,tier,speed,quality,specialties"}
  - {"file":"src/components/ai/ModelSelector.jsx","line":419,"kind":"english-only-inline-content","key":"name","value":"Google Veo","siblingKeys":"id,name,provider,tier,speed,quality,specialties"}
  - {"file":"src/components/ai/ModelSelector.jsx","line":427,"kind":"english-only-inline-content","key":"description","value":"Google's flagship model for creating longer, high-definition videos.","siblingKeys":"id,name,provider,tier,speed,quality,specialties"}
  - {"file":"src/components/ai/ModelSelector.jsx","line":432,"kind":"english-only-inline-content","key":"name","value":"OpenAI Sora","siblingKeys":"id,name,provider,tier,speed,quality,specialties"}
  - {"file":"src/components/ai/ModelSelector.jsx","line":440,"kind":"english-only-inline-content","key":"description","value":"The most anticipated model for generating hyper-realistic and long vid","siblingKeys":"id,name,provider,tier,speed,quality,specialties"}
  - {"file":"src/components/ai/ModelSelector.jsx","line":447,"kind":"english-only-inline-content","key":"name","value":"Suno Basic","siblingKeys":"id,name,provider,tier,speed,quality,specialties"}
  - {"file":"src/components/ai/ModelSelector.jsx","line":455,"kind":"english-only-inline-content","key":"description","value":"Create short songs and music clips from text prompts.","siblingKeys":"id,name,provider,tier,speed,quality,specialties"}
  - {"file":"src/components/ai/ModelSelector.jsx","line":460,"kind":"english-only-inline-content","key":"name","value":"Udio Creator","siblingKeys":"id,name,provider,tier,speed,quality,specialties"}
  - {"file":"src/components/ai/ModelSelector.jsx","line":468,"kind":"english-only-inline-content","key":"description","value":"Generate full-length, high-quality music tracks and instrumentals.","siblingKeys":"id,name,provider,tier,speed,quality,specialties"}
  - {"file":"src/components/ai/ModelSelector.jsx","line":473,"kind":"english-only-inline-content","key":"name","value":"Stable Audio Pro","siblingKeys":"id,name,provider,tier,speed,quality,specialties"}
  - {"file":"src/components/ai/ModelSelector.jsx","line":481,"kind":"english-only-inline-content","key":"description","value":"Professional tool for generating high-fidelity music and sound effects","siblingKeys":"id,name,provider,tier,speed,quality,specialties"}
  - {"file":"src/components/ai/TextOverlay.jsx","line":70,"kind":"english-only-inline-content","key":"label","value":"Times New Roman","siblingKeys":"value,label"}
  - {"file":"src/components/ai/TextOverlay.jsx","line":72,"kind":"english-only-inline-content","key":"label","value":"Comic Sans","siblingKeys":"value,label"}
  - {"file":"src/components/bookCreation/PageStyler.jsx","line":30,"kind":"english-only-inline-content","key":"label","value":"Times New Roman","siblingKeys":"value,label"}
  - {"file":"src/components/bookCreation/PageStyler.jsx","line":31,"kind":"english-only-inline-content","key":"label","value":"Courier New","siblingKeys":"value,label"}
  - {"file":"src/components/settings/DeleteAccountCard.jsx","line":34,"kind":"english-only-inline-content","key":"title","value":"Delete account and data","siblingKeys":"title,desc,open,dialogTitle,dialogLead,items,keep"}
  - {"file":"src/data/privacyPolicyContent.js","line":177,"kind":"english-only-inline-content","key":"title","value":"Privacy Policy","siblingKeys":"metaTitle,metaDesc,title,subtitle,backLink,termsLink,sections"}
  - {"file":"src/data/privacyPolicyContent.js","line":368,"kind":"english-only-inline-content","key":"title","value":"Before we start: you decide","siblingKeys":"title,lead,rows,fullPolicy,terms,guardian,agree"}
  - {"file":"src/data/privacyPolicyContent.js","line":371,"kind":"english-only-inline-content","key":"title","value":"What we keep","siblingKeys":"icon,title,text"}
  - {"file":"src/data/privacyPolicyContent.js","line":372,"kind":"english-only-inline-content","key":"title","value":"Photos you upload","siblingKeys":"icon,title,text"}
  - {"file":"src/data/privacyPolicyContent.js","line":374,"kind":"english-only-inline-content","key":"title","value":"Who else handles it","siblingKeys":"icon,title,text,help"}
  - {"file":"src/data/privacyPolicyContent.js","line":375,"kind":"english-only-inline-content","key":"title","value":"You can delete everything","siblingKeys":"icon,title,text"}
  - {"file":"src/data/privacyPolicyContent.js","line":376,"kind":"english-only-inline-content","key":"title","value":"You, the parent, decide","siblingKeys":"icon,title,text"}
  - {"file":"src/lib/smartModelPicker.js","line":37,"kind":"english-only-inline-content","key":"label","value":"Gemini Fast","siblingKeys":"id,provider,backendModel,tier,label,hebrewQuality,photoRealism"}
  - {"file":"src/lib/smartModelPicker.js","line":59,"kind":"english-only-inline-content","key":"label","value":"GPT Image 1 (OpenAI)","siblingKeys":"id,provider,backendModel,tier,label,hebrewQuality,photoRealism"}
  - {"file":"src/lib/storyBible.js","line":62,"kind":"english-only-inline-content","key":"description","value":"Short, evocative book title in target language","siblingKeys":"type,description"}
  - {"file":"src/lib/storyBible.js","line":63,"kind":"english-only-inline-content","key":"description","value":"One-sentence age-appropriate takeaway","siblingKeys":"type,description"}
  - {"file":"src/lib/storyBible.js","line":66,"kind":"english-only-inline-content","key":"description","value":"Locked character descriptors (referenced verbatim in each image prompt","siblingKeys":"type,description,items"}
  - {"file":"src/lib/storyBible.js","line":76,"kind":"english-only-inline-content","key":"description","value":"Physical anchor: age, hair, eye color, clothing, accessories, body lan","siblingKeys":"type,description"}
  - {"file":"src/lib/storyBible.js","line":84,"kind":"english-only-inline-content","key":"description","value":"One sentence, reused as the style anchor in every image prompt. e.g. \"","siblingKeys":"type,description"}
  - {"file":"src/lib/storyBible.js","line":88,"kind":"english-only-inline-content","key":"description","value":"bedtime | playful | dramatic-lite — drives TTS voice + instructions","siblingKeys":"type,description"}
  - {"file":"src/lib/storyBible.js","line":92,"kind":"english-only-inline-content","key":"description","value":"Page-by-page beats","siblingKeys":"type,description,items"}

With a *He sibling (bilingual by convention, lower risk): 1
