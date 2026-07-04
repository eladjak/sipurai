/**
 * Demo books for Sipurai's Showcase section.
 * These are complete sample stories that visitors can browse through
 * to experience the platform before signing up.
 *
 * Each book showcases a different art style and genre to demonstrate
 * the platform's full range of capabilities.
 */

const demoBooks = [
  {
    id: 'demo-dragons-garden',
    title: {
      he: 'הגן הסודי של הדרקון',
      en: "The Dragon's Secret Garden",
    },
    genre: 'fantasy',
    art_style: 'watercolor',
    age_range: '5-8',
    language: 'hebrew',
    moral: 'אומץ וחסד יכולים להפוך אויבים לחברים',
    cover_gradient: 'from-emerald-400 via-teal-500 to-green-600',
    pages: [
      {
        pageNumber: 1,
        text: 'לילי הייתה ילדה שקטה עם צמות ארוכות ועיניים חומות גדולות. היא אהבה לטייל ביער שליד הכפר, לאסוף עלים צבעוניים ולדבר עם החיות. יום אחד, בשביל שלא הכירה, גילתה חומה עתיקה מכוסת בקיסוס ירוק. בין האבנים הייתה דלת עץ קטנה, פתוחה רק מעט. אור זהוב חמים בקע מבפנים.',
        textEn: 'Lily was a quiet girl with long braids and big brown eyes. She loved walking in the forest near her village, collecting colorful leaves and talking to the animals. One day, on a path she had never taken before, she discovered an ancient wall covered in green ivy. Between the stones was a small wooden door, open just a crack. Warm golden light glowed from within.',
        imagePrompt:
          'Delicate watercolor illustration of a shy girl (age 6) with long brown braids discovering an ancient moss-covered stone wall in a magical forest. A small wooden door is slightly ajar, warm golden light streaming through the crack. Lush green ivy, dappled sunlight through tall trees, scattered autumn leaves on the ground. Soft watercolor washes with visible brush texture, children book illustration style, gentle and inviting atmosphere.',
      },
      {
        pageNumber: 2,
        text: 'לילי דחפה את הדלת בזהירות ונכנסה. הגן שגילתה היה הכי מופלא שראתה — פרחים בכל צבעי הקשת זוהרים באור רך, פרפרים ענקיים בגודל של ציפורים מרחפים באוויר, ועצים שפירותיהם נוצצו כמו אבני חן. לפתע שמעה נשימה עמוקה מאחורי השיחים. שתי עיניים ירוקות ענקיות, גדולות כמו צלחות, הביטו בה.',
        textEn: 'Lily carefully pushed the door and stepped inside. The garden she discovered was the most wondrous she had ever seen — flowers of every rainbow color glowing with soft light, enormous butterflies the size of birds floating in the air, and trees whose fruits sparkled like gemstones. Suddenly she heard a deep breath from behind the bushes. Two enormous green eyes, large as dinner plates, stared at her.',
        imagePrompt:
          'Luminous watercolor painting of a magical secret garden from a child perspective — rainbow flowers glowing with bioluminescence, giant butterflies (size of birds) with iridescent wings, fruit trees with sparkling crystal-like fruits. A small girl stands at the entrance in awe. Two large emerald-green eyes peer from behind flowering bushes. Dreamy watercolor style with wet-on-wet technique, luminous ethereal colors, professional children book illustration.',
      },
      {
        pageNumber: 3,
        text: 'לילי רצתה לברוח, אבל אז שמעה משהו שגרם לה לעצור — הדרקון הגדול והירוק... בכה. דמעות כבועות סבון ירדו מעיניו ונפלו על הפרחים, שצמחו גבוה יותר בכל מקום שנגעו. "אל תפחדי," לחש בקול רועד. "אני אזמרגד. שומר על הגן הזה כבר מאות שנים. אבל כבר הרבה זמן שאף אחד לא בא. כל כך לבד."',
        textEn: 'Lily wanted to run, but then she heard something that made her stop — the large green dragon was... crying. Tears like soap bubbles rolled from his eyes and fell on the flowers, which grew taller wherever they touched. "Don\'t be afraid," he whispered in a trembling voice. "I am Emerald. I\'ve been guarding this garden for hundreds of years. But no one has come for so long. So very alone."',
        imagePrompt:
          'Emotional watercolor illustration of a large but gentle green dragon sitting among flowers, crying big translucent bubble-like tears. Where tears fall, flowers bloom and grow taller. A brave small girl with braids stands before him, her initial fear turning to compassion. The dragon has a kind, sad face — not scary at all. Soft watercolor washes with wet tears effect, warm emotional lighting, children book illustration style.',
      },
      {
        pageNumber: 4,
        text: 'לילי הרגישה את הפחד נמס מליבה כמו שלג באביב. היא ניגשה לאזמרגד והניחה את ידה הקטנה על כפתו הענקית. "אני לילי," אמרה בחיוך. "אני אבוא לבקר אותך כל יום. ואני אביא גם חברים!" הדרקון חייך לראשונה מזה מאה שנים. מנשימתו החמה צמחו פרחים חדשים בכל הגן — ורדים כחולים, חמניות זהובות, וסחלבים בצבע סגול שלא ראו מעולם.',
        textEn: 'Lily felt the fear melt from her heart like snow in spring. She walked up to Emerald and placed her small hand on his enormous paw. "I\'m Lily," she said with a smile. "I\'ll come visit you every day. And I\'ll bring friends too!" The dragon smiled for the first time in a hundred years. From his warm breath, new flowers bloomed throughout the garden — blue roses, golden sunflowers, and purple orchids no one had ever seen before.',
        imagePrompt:
          'Tender watercolor illustration of a small girl placing her tiny hand on a large green dragon paw — a touching moment of connection. The dragon smiles warmly for the first time, and from his warm breath new magical flowers bloom everywhere: blue roses, golden sunflowers, purple orchids. Garden transforms with new vibrant life. Warm golden light, emotional watercolor style with visible brushwork, children book illustration.',
      },
      {
        pageNumber: 5,
        text: 'מאז, לילי באה לגן כל יום אחרי בית הספר. היא הביאה את חבריה, ואזמרגד סיפר להם סיפורים על עולמות רחוקים ונסיכות אמיצות. הגן הסודי הפך למקום הכי שמח ביער. ולילי למדה את הסוד הכי חשוב — שלפעמים הדברים הכי מפחידים מסתירים בתוכם את הדברים הכי יפים. צריך רק קצת אומץ ולב טוב כדי לגלות את זה.',
        textEn: 'From that day on, Lily came to the garden every day after school. She brought her friends, and Emerald told them stories of faraway worlds and brave princesses. The secret garden became the happiest place in the forest. And Lily learned the most important secret of all — that sometimes the scariest things hide the most beautiful things inside them. You just need a little courage and a good heart to discover it.',
        imagePrompt:
          'Joyful watercolor illustration finale — a group of diverse happy children sitting in a circle around a large friendly green dragon in a magical blooming garden, listening to stories with wonder on their faces. The shy girl from before is now confident, sitting closest to the dragon. Giant butterflies, glowing flowers, warm sunset light streaming through trees. Celebratory, warm, triumphant ending scene. Professional watercolor children book illustration with rich detail.',
      },
    ],
  },
  {
    id: 'demo-space-adventure',
    title: {
      he: 'הרפתקה בחלל עם יעל',
      en: 'Space Adventure with Yael',
    },
    genre: 'science-fiction',
    art_style: 'pixar',
    age_range: '6-10',
    language: 'hebrew',
    moral: 'סקרנות ועבודת צוות פותרות כל בעיה',
    cover_gradient: 'from-indigo-500 via-purple-500 to-blue-600',
    pages: [
      {
        pageNumber: 1,
        text: 'יעל אהבה לבנות דברים. מקופסאות קרטון — טירות. ממכסי בקבוקים — רובוטים. מצינורות ישנים — טלסקופ שבו היא צפתה בכוכבים כל לילה. יום אחד, אחרי שראתה כוכב שביט חולף, יעל החליטה: "אני בונה חללית!" היא אספה חלקים ממוחזרים מכל השכונה, פתחה את ארגז הכלים של סבא, והתחילה לעבוד.',
        textEn: 'Yael loved building things. From cardboard boxes — castles. From bottle caps — robots. From old pipes — a telescope she used to watch the stars every night. One day, after seeing a comet streak across the sky, Yael decided: "I\'m building a spaceship!" She gathered recycled parts from the whole neighborhood, opened Grandpa\'s toolbox, and got to work.',
        imagePrompt:
          'Pixar-style 3D rendered illustration of a creative Israeli girl (age 8) with curly dark hair, overalls, and safety goggles, building a spaceship from recycled materials in her backyard. Cardboard boxes, plastic bottles, old pipes, and tools scattered around. A homemade telescope points at a starry twilight sky. Bright optimistic lighting, warm evening glow, highly detailed Pixar-quality rendering with subsurface scattering on skin, children movie quality.',
      },
      {
        pageNumber: 2,
        text: 'כשיעל סיימה, היא לחצה על הכפתור האדום הגדול. החללית רעדה, השמיעה צפצוף ו... המריאה! יעל טסה מעל הבתים, מעל העננים, מעבר לירח — עד שהגיעה לכוכב לכת מוזר ומופלא. שם הכול היה הפוך! העצים גדלו שורשים למעלה, הגשם עלה מהאדמה לשמיים, והילדים הלכו על הידיים בשביל הכיף.',
        textEn: 'When Yael finished, she pressed the big red button. The spaceship trembled, beeped loudly, and... took off! Yael flew above the houses, above the clouds, past the moon — until she reached a strange and wonderful planet. There, everything was upside down! Trees grew with roots pointing up, rain fell upward from the ground to the sky, and children walked on their hands just for fun.',
        imagePrompt:
          'Pixar-style 3D illustration of a homemade recycled-material spaceship flying through vibrant colorful space, approaching a whimsical upside-down planet. On the planet surface: trees grow with roots up and canopy down, rain rises from the ground, children walk on their hands. A girl looks through the cockpit window in amazement. Rich nebula colors in background, volumetric lighting, Pixar-quality rendering with depth of field, playful and whimsical.',
      },
      {
        pageNumber: 3,
        text: 'בום! החללית נחתה קצת חזק מדי ואחד הכנפיים נשבר. "אוי," אמרה יעל. "איך אני חוזרת הביתה?" מאחורי סלע הפוך הציצו שלושה ילדים חייזרים — עם אוזניים סגולות, עור כחלכל, וחיוכים ענקיים. "שלום! אני זיפי," אמרה אחת. "אנחנו תמיד רוצים לפגוש מישהו חדש! בואי, נעזור לך!"',
        textEn: 'Boom! The spaceship landed a bit too hard and one wing broke off. "Oh no," said Yael. "How do I get back home?" From behind an upside-down rock, three alien children peeked out — with purple ears, bluish skin, and enormous smiles. "Hello! I\'m Zipi," said one of them. "We always want to meet someone new! Come, we\'ll help you!"',
        imagePrompt:
          'Pixar-style 3D illustration of a crashed homemade spaceship with a broken wing on an upside-down alien planet. Three adorable alien children with purple pointy ears, light blue skin, and big friendly smiles peek from behind an upside-down boulder. An Israeli girl stands by her ship looking worried but hopeful. Whimsical alien vegetation, upside-down landscape, Pixar-quality character design with expressive eyes and appealing shapes.',
      },
      {
        pageNumber: 4,
        text: 'יעל וחברותיה החדשות עבדו ביחד כל היום. זיפי מצאה צמחים שיכולים לשמש כדבק חזק במיוחד. בובו, חבר נוסף, הביא אבנים קלות שיכולות להחליף את הכנף. ויעל לימדה אותם לחבר הכול עם ברגים. "וואו!" קראה זיפי. "אצלכם משתמשים בכלים! אצלנו אנחנו פשוט מדמיינים ודברים מתרכבים!" "אולי נשלב את שתי הדרכים?" הציעה יעל.',
        textEn: 'Yael and her new friends worked together all day long. Zipi found plants that could serve as super-strong glue. Bobo, another friend, brought lightweight stones that could replace the wing. And Yael taught them how to connect everything with screws. "Wow!" exclaimed Zipi. "You use tools! On our planet, we just imagine things and they assemble themselves!" "Maybe we can combine both ways?" suggested Yael.',
        imagePrompt:
          'Pixar-style 3D illustration of teamwork — an Israeli girl and three cute alien children working together to repair a spaceship. One alien applies glowing plant-based glue, another carries floating lightweight stones, the girl uses a wrench. They combine alien imagination-power (shown as sparkly thought bubbles) with human tools. Everyone smiling, collaborative warm atmosphere, golden hour lighting, Pixar-quality with rich textures and materials.',
      },
      {
        pageNumber: 5,
        text: '"בואי לבקר שוב!" חייכה זיפי כשיעל עלתה לחללית המשודרגת. "בטוח! ואולי בפעם הבאה אתם תבואו אליי. רק תזכרו — אצלנו הכול בכיוון הנכון!" כולם צחקו. יעל הפעילה את המנוע — עכשיו הוא עבד אפילו יותר טוב! בדרך הביתה, היא חייכה לכוכבים. היום היא למדה שאפשר לפתור כל בעיה — אם עושים את זה ביחד, ומשלבים רעיונות מעולמות שונים.',
        textEn: '"Come visit again!" smiled Zipi as Yael climbed into her upgraded spaceship. "Definitely! And maybe next time you\'ll come to my planet. Just remember — where I\'m from, everything is right-side up!" Everyone laughed. Yael fired up the engine — now it worked even better! On the way home, she smiled at the stars. Today she learned that you can solve any problem — if you do it together, combining ideas from different worlds.',
        imagePrompt:
          'Pixar-style 3D illustration of a heartwarming farewell — a girl waves from her upgraded, now-glowing spaceship window to three alien friends standing on their upside-down planet waving back. The spaceship looks better than before with alien crystal additions. Stars, colorful nebulas, and a comet trail in the background. Emotional, uplifting ending with warm rim lighting, lens flare, Pixar-quality cinematic composition.',
      },
    ],
  },
  {
    id: 'demo-brave-fox',
    title: {
      he: 'השועל האמיץ הקטן',
      en: 'The Brave Little Fox',
    },
    genre: 'adventure',
    art_style: 'storybook',
    age_range: '4-7',
    language: 'hebrew',
    moral: 'להיות קטן לא אומר להיות חלש — לכל אחד יש כוח מיוחד',
    cover_gradient: 'from-orange-400 via-amber-500 to-yellow-500',
    pages: [
      {
        pageNumber: 1,
        text: 'ביער הגדול גרה משפחה של שועלים. כולם היו מהירים וזריזים — חוץ מערן הקטן. ערן היה הכי קטן ביער. הוא לא הצליח לרוץ מהר כמו אחיו, לא יכול לקפוץ גבוה כמו אחותו, ולא הצליח לשאוג חזק כמו אבא. "אל תדאג, ערן שלי," חייכה אמא ונישקה את מצחו. "יום אחד תגלה מה הכוח המיוחד שלך."',
        textEn: 'In the big forest lived a family of foxes. They were all fast and agile — except for little Eran. Eran was the smallest in the whole forest. He couldn\'t run as fast as his brothers, couldn\'t jump as high as his sister, and couldn\'t roar as loud as Papa. "Don\'t worry, my little Eran," Mama smiled and kissed his forehead. "One day you\'ll discover your special strength."',
        imagePrompt:
          'Classic storybook illustration of a small adorable fox cub with big amber eyes looking up at his bigger fox siblings who are running and jumping through an autumn forest. The little fox looks a bit wistful but has a determined spark in his eyes. Mother fox nuzzles him tenderly. Rich autumn colors — golden leaves, warm orange tones, soft dappled light through branches. Traditional hand-drawn storybook art with visible ink lines and soft color fills, nostalgic picture book quality.',
      },
      {
        pageNumber: 2,
        text: 'יום אחד, כשערן טייל ביער, שמע צפצוף חלש. בין שורשי אלון עתיק מצא ציפור קטנטנה עם כנף שבורה. "אני אעזור לך," לחש ערן בעדינות. הוא הביא עלים רכים ועטף את הכנף. חיפש גרגרים וטפטף מים מעלה ירוק. כל יום ערן חזר — עם אוכל, עם סיפורים, ועם חיוך. לאט לאט, הציפור הקטנה התחילה לשיר.',
        textEn: 'One day, while walking in the forest, Eran heard a faint chirp. Between the roots of an ancient oak tree, he found a tiny bird with a broken wing. "I\'ll help you," Eran whispered gently. He brought soft leaves and carefully wrapped the wing. He searched for seeds and dripped water from a green leaf. Every day Eran returned — with food, with stories, and with a smile. Slowly, the little bird began to sing again.',
        imagePrompt:
          'Classic storybook illustration of a small gentle fox carefully tending to a tiny injured bird nestled among the roots of a massive ancient oak tree. The fox wraps the bird wing with soft leaves, surrounded by healing herbs, small mushrooms, and ferns on the forest floor. Dappled golden light filters through the canopy. Tender, caring scene rendered in traditional storybook art with fine ink outlines, warm earth tones, and hand-painted watercolor textures.',
      },
      {
        pageNumber: 3,
        text: 'השמועה התפשטה ביער כמו רוח. חיות מכל הצדדים התחילו לבוא — ארנבון עם כפה כואבת, קיפוד עם קוץ תקוע, ואפילו דב גדול עם כאב שיניים נורא. "בבקשה, ערן, עזור לי," התחנן הדב הענק. ערן, בלי לפחד, טיפס על ראש הדב, הציץ לתוך הפה הגדול, ובזהירות שלף את הקוץ. "תודה!" שאג הדב בשמחה — כל כך חזק שהעלים נפלו מהעצים.',
        textEn: 'The news spread through the forest like the wind. Animals came from every direction — a bunny with a sore paw, a hedgehog with a stuck thorn, and even a huge bear with a terrible toothache. "Please, Eran, help me," begged the enormous bear. Eran, without fear, climbed up on top of the bear\'s head, peeked inside the big mouth, and carefully pulled out the thorn. "Thank you!" roared the bear with joy — so loudly that leaves fell from the trees.',
        imagePrompt:
          'Charming storybook illustration of a small fox acting as a forest healer. A line of forest animals waits for help: a bunny holding its paw, a hedgehog, and a large gentle bear opening its enormous mouth while the tiny brave fox stands on its head, pulling a thorn. Herbs, bandages made of leaves, and healing plants around a small natural clinic. Traditional storybook art with warm humor, fine detailed ink work, golden autumn palette, picture book quality.',
      },
      {
        pageNumber: 4,
        text: 'באחד הלילות פרצה סערה חזקה. רעמים רעמו, ברקים הבהבו, עצים נפלו וחסמו את השבילים. חיות רבות נפצעו ובהלה שררה ביער. גם השועלים המהירים לא ידעו מה לעשות. אבל ערן? ערן ידע בדיוק. "עקבו אחריי!" קרא בקול חזק וברור שלא שמעו ממנו מעולם. הוא ארגן את כולם — הדובים פינו את העצים, השועלים המהירים רצו להביא צמחי מרפא, והארנבונים טיפלו בפצועים.',
        textEn: 'One night, a fierce storm struck. Thunder boomed, lightning flashed, trees fell and blocked the paths. Many animals were hurt and panic filled the forest. Even the fast foxes didn\'t know what to do. But Eran? Eran knew exactly. "Follow me!" he called in a strong, clear voice no one had ever heard from him before. He organized everyone — the bears cleared the fallen trees, the fast foxes ran to gather healing herbs, and the bunnies tended to the injured.',
        imagePrompt:
          'Dramatic storybook illustration of a stormy forest night. A small brave fox stands tall on a rock, confidently directing rescue operations — bears clearing fallen trees, fast foxes running with herbs in their mouths, rabbits bandaging injured animals. Lightning illuminates the scene dramatically but the fox face shows calm leadership. Dynamic composition with swirling wind and rain, yet hope and determination on every face. Traditional storybook art with dramatic lighting, bold ink lines, rich dark tones contrasted with warm lantern-like glows.',
      },
      {
        pageNumber: 5,
        text: 'בבוקר, כשהשמש זרחה שוב, כל חיות היער התאספו סביב ערן. "אתה הגיבור שלנו!" שאג הדב. "אבל אני הכי קטן..." הסמיק ערן. אמא שלו חיבקה אותו בזנבה הרך. "אתה הכי קטן בגודל," אמרה, "אבל הכי גדול בלב ובחוכמה." מאז, ערן הפך למרפא הרשמי של היער. והוא גילה את הסוד — לא צריך להיות הכי מהיר או הכי חזק. צריך רק למצוא את מה שאתה עושה הכי טוב, ולתת את זה לעולם.',
        textEn: 'In the morning, when the sun shone again, all the forest animals gathered around Eran. "You\'re our hero!" roared the bear. "But I\'m the smallest..." Eran blushed. His mama wrapped him in her soft tail. "You\'re the smallest in size," she said, "but the biggest in heart and wisdom." From that day on, Eran became the official healer of the forest. And he discovered the secret — you don\'t need to be the fastest or the strongest. You just need to find what you do best, and give it to the world.',
        imagePrompt:
          'Triumphant storybook illustration finale — all forest animals gathered in a sunlit clearing celebrating a small fox. The bear lifts him gently, birds sing overhead, flowers bloom everywhere. The little fox looks proud but humble, mother fox beaming beside him. Morning golden light streams through trees creating dramatic god-rays. Every animal from the story is present — the healed bird flies overhead, the bunny, hedgehog, and bear all smile. Traditional storybook art with rich golden warm light, detailed ink work, celebratory joyful atmosphere, classic picture book ending.',
      },
    ],
  },
];

// Attach the generated demo artwork (character-consistent WebP illustrations
// under public/demo/<id>/, produced by scripts/generate-demo-images.mjs).
// Derived from id + pageNumber so adding a book needs no manual path wiring.
// Components fall back to the gradient placeholder when a path is absent.
for (const book of demoBooks) {
  book.cover_image = `/demo/${book.id}/cover.webp`;
  for (const page of book.pages) {
    page.image = `/demo/${book.id}/page-${page.pageNumber}.webp`;
  }
}

export default demoBooks;
