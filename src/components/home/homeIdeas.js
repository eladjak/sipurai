const ideas = {
  adventure: ['מפה בלי שמות', 'בכיס של מעיל ישן נמצאה מפה. השביל מתחיל ממש מתחת למיטה.', 'A map with no names', 'A map turns up in an old coat pocket. The trail starts right under the bed.'],
  animals: ['הקיפוד בלי הצל', 'קיפוד התעורר בבוקר וגילה שהצל שלו יצא לטיול. לאן הוא הלך?', 'The hedgehog’s missing shadow', 'A hedgehog woke up to find that his shadow had gone for a walk. Where did it go?'],
  science: ['טיפה עם סוד', 'מתחת לזכוכית המגדלת, טיפת מים התחילה לנצנץ. מה חי בתוכה?', 'A drop with a secret', 'Under the magnifying glass, a drop of water started to sparkle. What was living inside?'],
  fairy_tale: ['הכתר שעל העץ', 'דרור הביא לקן כתר זעיר. מי בממלכה מחפש אותו?', 'A crown in a tree', 'A sparrow brought a tiny crown to its nest. Who in the kingdom is looking for it?'],
  family: ['מתכון ליום גשם', 'סבתא פתחה את ספר המתכונים ומצאה הוראות להכנת קשת בענן.', 'A recipe for a rainy day', 'Grandma opened her cookbook and found instructions for making a rainbow.'],
  friendship: ['מכתב מעבר לגדר', 'פתק קטן הופיע בין שני גנים. מי כתב אותו, ואיזו תשובה תגיע?', 'A letter over the fence', 'A note appeared between two gardens. Who wrote it, and what reply will come?'],
  nature: ['הלילה שבו העץ לחש', 'עץ ותיק ביקש מהילדים לשמור על זרע אחד עד הבוקר. מה יצמח ממנו?', 'The night the tree whispered', 'An old tree asked the children to keep one seed safe until morning. What might grow from it?'],
  magic: ['דלת בגודל אגודל', 'דלת זעירה הופיעה במדף הספרים. מאחוריה מישהו ביקש עזרה בלחש.', 'A door the size of a thumb', 'A tiny door appeared in the bookshelf. Someone behind it whispered for help.'],
  space: ['חללית בעציץ', 'באמצע הלילה נחתה חללית קטנה בעציץ. מי יצא ממנה?', 'A spaceship in a flowerpot', 'At midnight, a tiny spaceship landed in a flowerpot. Who stepped out?'],
  art: ['הציור שרצה לצאת', 'ילדה ציירה דג בכחול. כשהניחה את המכחול, הדג קפץ לתוך הכוס.', 'The painting that wanted out', 'A girl painted a blue fish. When she put down her brush, it jumped into her cup.'],
  music: ['המנגינה מהחלון', 'רוח הלילה ניגנה על אדן החלון. מה יקרה אם מישהו יענה לה בשיר?', 'The tune at the window', 'The night wind played a tune on the windowsill. What happens if someone sings back?'],
  travel: ['כרטיס למקום רחוק', 'בתחנה חיכה כרטיס לרכבת שמגיעה רק בחלומות. איפה התחנה הבאה?', 'A ticket somewhere far away', 'A ticket waited at the station for a train that only comes in dreams. Where is the next stop?'],
  humor: ['מסיבת הכובעים', 'כל הכובעים במסיבה החליפו ראשים כשמישהו התעטש. איך מחזירים אותם למקום?', 'The hat party', 'All the hats at the party swapped heads when someone sneezed. How will they get back?'],
  bedtime: ['הכוכב שלא נרדם', 'כל הכוכבים נרדמו, חוץ מאחד. מה יעזור לו לעצום עיניים?', 'The star that couldn’t sleep', 'All the stars fell asleep except one. What might help it close its eyes?'],
  sports: ['הכדור שרצה לשחק', 'כדור התגלגל מהמגרש והזמין את הילדים למשחק עם חוקים משלו.', 'The ball that wanted to play', 'A ball rolled off the field and invited the children to play a game with its own rules.'],
};

const general = ['adventure', 'nature', 'magic', 'animals', 'travel', 'bedtime', 'family'];
const alternateArt = { humor: 'friendship', bedtime: 'space', sports: 'adventure' };

export function homeIdea(favoriteTopics, language, today = new Date()) {
  const supported = Array.isArray(favoriteTopics)
    ? [...new Set(favoriteTopics.map(topic => topic === 'fantasy' ? 'magic' : topic)
      .filter(topic => typeof topic === 'string' && Object.hasOwn(ideas, topic)))]
    : [];
  const choices = supported.length ? supported : general;
  const day = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) / 86400000;
  const topic = choices[(day % choices.length + choices.length) % choices.length];
  const [heTitle, heDescription, enTitle, enDescription] = ideas[topic];
  const english = language === 'english' || language === 'en';
  return {
    title: english ? enTitle : heTitle,
    description: english ? enDescription : heDescription,
    image: `/images/spx/topics/${alternateArt[topic] || topic}.webp`,
  };
}
