// Recommendations for books you do not own yet: a curated bilingual catalogue of widely read works,
// ranked against your own library, plus optional live suggestions from Open Library.
import type { Book } from '../types';
import { norm } from './filter';

export interface CatalogBook { id: string; t: [string, string]; a: [string, string]; c: string; g: string[]; y: number }

const B = (id: string, en: string, ar: string, aen: string, aar: string, c: string, g: string[], y: number): CatalogBook => ({ id, t: [en, ar], a: [aen, aar], c, g, y });

export const CATALOG: CatalogBook[] = [
  // Russia
  B('ru1', 'Crime and Punishment', 'الجريمة والعقاب', 'Fyodor Dostoevsky', 'فيودور دوستويفسكي', 'ru', ['classic', 'literary'], 1866),
  B('ru2', 'The Brothers Karamazov', 'الإخوة كارامازوف', 'Fyodor Dostoevsky', 'فيودور دوستويفسكي', 'ru', ['classic', 'philosophy'], 1880),
  B('ru3', 'War and Peace', 'الحرب والسلام', 'Leo Tolstoy', 'ليو تولستوي', 'ru', ['classic', 'historical-fiction'], 1869),
  B('ru4', 'Anna Karenina', 'آنا كارنينا', 'Leo Tolstoy', 'ليو تولستوي', 'ru', ['classic', 'literary'], 1878),
  B('ru5', 'Dead Souls', 'الأرواح الميتة', 'Nikolai Gogol', 'نيكولاي غوغول', 'ru', ['classic'], 1842),
  B('ru6', 'The Master and Margarita', 'المعلم ومارغريتا', 'Mikhail Bulgakov', 'ميخائيل بولغاكوف', 'ru', ['classic', 'fantasy'], 1967),
  B('ru7', 'Fathers and Sons', 'آباء وأبناء', 'Ivan Turgenev', 'إيفان تورغينيف', 'ru', ['classic'], 1862),
  B('ru8', 'Oblomov', 'أوبلوموف', 'Ivan Goncharov', 'إيفان غونتشاروف', 'ru', ['classic'], 1859),
  B('ru9', 'One Day in the Life of Ivan Denisovich', 'يوم في حياة إيفان دينيسوفيتش', 'Aleksandr Solzhenitsyn', 'ألكسندر سولجنيتسين', 'ru', ['literary', 'novella'], 1962),
  B('ru10', 'Doctor Zhivago', 'دكتور جيفاغو', 'Boris Pasternak', 'بوريس باسترناك', 'ru', ['classic', 'historical-fiction'], 1957),
  // Arab world
  B('ar1', 'Season of Migration to the North', 'موسم الهجرة إلى الشمال', 'Tayeb Salih', 'الطيب صالح', 'sd', ['classic', 'literary'], 1966),
  B('ar2', 'The Wedding of Zein', 'عرس الزين', 'Tayeb Salih', 'الطيب صالح', 'sd', ['novella'], 1962),
  B('ar3', 'The Longing of the Dervish', 'شوق الدرويش', 'Hammour Ziada', 'حمّور زيادة', 'sd', ['historical-fiction'], 2014),
  B('ar4', 'Palace Walk', 'بين القصرين', 'Naguib Mahfouz', 'نجيب محفوظ', 'eg', ['classic', 'literary'], 1956),
  B('ar5', 'Children of the Alley', 'أولاد حارتنا', 'Naguib Mahfouz', 'نجيب محفوظ', 'eg', ['literary'], 1959),
  B('ar6', 'The Days', 'الأيام', 'Taha Hussein', 'طه حسين', 'eg', ['autobiography', 'classic'], 1929),
  B('ar7', 'Azazeel', 'عزازيل', 'Youssef Ziedan', 'يوسف زيدان', 'eg', ['historical-fiction'], 2008),
  B('ar8', 'Men in the Sun', 'رجال في الشمس', 'Ghassan Kanafani', 'غسان كنفاني', 'ps', ['novella', 'literary'], 1963),
  B('ar9', 'Cities of Salt', 'مدن الملح', 'Abdul Rahman Munif', 'عبد الرحمن منيف', 'sa', ['literary', 'historical-fiction'], 1984),
  B('ar10', 'Granada Trilogy', 'ثلاثية غرناطة', 'Radwa Ashour', 'رضوى عاشور', 'eg', ['historical-fiction'], 1994),
  B('ar11', 'Gate of the Sun', 'باب الشمس', 'Elias Khoury', 'إلياس خوري', 'lb', ['literary'], 1998),
  B('ar12', 'The Prophet', 'النبي', 'Kahlil Gibran', 'جبران خليل جبران', 'lb', ['poetry', 'philosophy'], 1923),
  B('ar13', 'The Muqaddimah', 'المقدمة', 'Ibn Khaldun', 'ابن خلدون', 'ma', ['history', 'sociology'], 1377),
  B('ar14', 'Kalila and Dimna', 'كليلة ودمنة', 'Ibn al-Muqaffa', 'ابن المقفع', 'arab', ['folklore', 'classic'], 750),
  B('ar15', 'For Bread Alone', 'الخبز الحافي', 'Mohamed Choukri', 'محمد شكري', 'ma', ['autobiography'], 1973),
  B('ar16', 'The Travels of Ibn Battuta', 'رحلة ابن بطوطة', 'Ibn Battuta', 'ابن بطوطة', 'ma', ['travel', 'history'], 1355),
  B('ar17', 'The Yacoubian Building', 'عمارة يعقوبيان', 'Alaa Al Aswany', 'علاء الأسواني', 'eg', ['contemporary'], 2002),
  // East & South Asia, Persia, Turkey
  B('jp1', 'Kokoro', 'كوكورو', 'Natsume Sōseki', 'ناتسومي سوسيكي', 'jp', ['classic', 'literary'], 1914),
  B('jp2', 'Snow Country', 'بلد الثلوج', 'Yasunari Kawabata', 'ياسوناري كاواباتا', 'jp', ['classic'], 1948),
  B('jp3', 'Rashōmon and Other Stories', 'راشومون وقصص أخرى', 'Ryūnosuke Akutagawa', 'ريونوسكي أكوتاغاوا', 'jp', ['short-stories'], 1915),
  B('jp4', 'Norwegian Wood', 'الغابة النرويجية', 'Haruki Murakami', 'هاروكي موراكامي', 'jp', ['contemporary'], 1987),
  B('cn1', 'Dream of the Red Chamber', 'حلم القصر الأحمر', 'Cao Xueqin', 'تساو شيويه تشين', 'cn', ['classic'], 1791),
  B('cn2', 'The True Story of Ah Q', 'القصة الحقيقية لآه كيو', 'Lu Xun', 'لو شون', 'cn', ['novella', 'classic'], 1922),
  B('cn3', 'To Live', 'أن تعيش', 'Yu Hua', 'يو هوا', 'cn', ['contemporary'], 1993),
  B('kr1', 'The Vegetarian', 'النباتية', 'Han Kang', 'هان كانغ', 'kr', ['contemporary'], 2007),
  B('kr2', 'Please Look After Mom', 'أرجوك اعتنِ بأمي', 'Shin Kyung-sook', 'شين كيونغ سوك', 'kr', ['contemporary'], 2008),
  B('in1', 'Gitanjali', 'جيتانجالي', 'Rabindranath Tagore', 'رابندرانات طاغور', 'in', ['poetry'], 1910),
  B('in2', 'The God of Small Things', 'إله الأشياء الصغيرة', 'Arundhati Roy', 'أروندهاتي روي', 'in', ['contemporary'], 1997),
  B('ir1', 'Shahnameh', 'الشاهنامة', 'Ferdowsi', 'الفردوسي', 'ir', ['poetry', 'mythology'], 1010),
  B('ir2', 'The Masnavi', 'المثنوي', 'Jalaluddin Rumi', 'جلال الدين الرومي', 'ir', ['poetry', 'religion'], 1273),
  B('ir3', 'Rubaiyat of Omar Khayyam', 'رباعيات الخيام', 'Omar Khayyam', 'عمر الخيام', 'ir', ['poetry'], 1120),
  B('ir4', 'The Blind Owl', 'البومة العمياء', 'Sadegh Hedayat', 'صادق هدايت', 'ir', ['literary'], 1937),
  B('ir5', 'Gulistan', 'گلستان (الروضة)', 'Saadi', 'سعدي الشيرازي', 'ir', ['poetry', 'classic'], 1258),
  B('tr1', 'My Name Is Red', 'اسمي أحمر', 'Orhan Pamuk', 'أورهان باموق', 'tr', ['historical-fiction', 'mystery'], 1998),
  B('tr2', 'Madonna in a Fur Coat', 'مادونا صاحبة معطف الفرو', 'Sabahattin Ali', 'صباح الدين علي', 'tr', ['classic'], 1943),
  B('tr3', 'Memed, My Hawk', 'محمد النحيل', 'Yaşar Kemal', 'يشار كمال', 'tr', ['classic'], 1955),
  B('tr4', 'The Forty Rules of Love', 'قواعد العشق الأربعون', 'Elif Shafak', 'إليف شافاق', 'tr', ['contemporary'], 2009),
  // Europe
  B('fr1', 'Les Misérables', 'البؤساء', 'Victor Hugo', 'فيكتور هوغو', 'fr', ['classic', 'historical-fiction'], 1862),
  B('fr2', 'The Stranger', 'الغريب', 'Albert Camus', 'ألبير كامو', 'fr', ['literary', 'philosophy'], 1942),
  B('fr3', 'The Plague', 'الطاعون', 'Albert Camus', 'ألبير كامو', 'fr', ['literary'], 1947),
  B('fr4', 'Madame Bovary', 'مدام بوفاري', 'Gustave Flaubert', 'غوستاف فلوبير', 'fr', ['classic'], 1857),
  B('fr5', 'The Little Prince', 'الأمير الصغير', 'Antoine de Saint-Exupéry', 'أنطوان دو سانت إكزوبيري', 'fr', ['classic'], 1943),
  B('fr6', 'Father Goriot', 'الأب غوريو', 'Honoré de Balzac', 'أونوريه دي بلزاك', 'fr', ['classic'], 1835),
  B('de1', 'The Metamorphosis', 'المسخ', 'Franz Kafka', 'فرانز كافكا', 'de', ['novella', 'classic'], 1915),
  B('de2', 'The Trial', 'المحاكمة', 'Franz Kafka', 'فرانز كافكا', 'de', ['classic'], 1925),
  B('de3', 'Faust', 'فاوست', 'Johann Wolfgang von Goethe', 'يوهان فولفغانغ فون غوته', 'de', ['drama', 'classic'], 1808),
  B('de4', 'Siddhartha', 'سدهارتا', 'Hermann Hesse', 'هيرمان هيسه', 'de', ['literary', 'philosophy'], 1922),
  B('de5', 'Steppenwolf', 'ذئب البراري', 'Hermann Hesse', 'هيرمان هيسه', 'de', ['literary'], 1927),
  B('de6', 'The Magic Mountain', 'الجبل السحري', 'Thomas Mann', 'توماس مان', 'de', ['classic'], 1924),
  B('gb1', 'Pride and Prejudice', 'كبرياء وتحامل', 'Jane Austen', 'جين أوستن', 'gb', ['classic', 'romance'], 1813),
  B('gb2', 'Nineteen Eighty-Four', '1984', 'George Orwell', 'جورج أورويل', 'gb', ['classic', 'scifi'], 1949),
  B('gb3', 'Animal Farm', 'مزرعة الحيوان', 'George Orwell', 'جورج أورويل', 'gb', ['classic', 'novella'], 1945),
  B('gb4', 'Great Expectations', 'آمال كبيرة', 'Charles Dickens', 'تشارلز ديكنز', 'gb', ['classic'], 1861),
  B('gb5', 'Jane Eyre', 'جين إير', 'Charlotte Brontë', 'شارلوت برونتي', 'gb', ['classic', 'romance'], 1847),
  B('gb6', 'Wuthering Heights', 'مرتفعات وذرينغ', 'Emily Brontë', 'إميلي برونتي', 'gb', ['classic'], 1847),
  B('gb7', 'Hamlet', 'هاملت', 'William Shakespeare', 'وليم شكسبير', 'gb', ['drama', 'classic'], 1603),
  B('es1', 'Don Quixote', 'دون كيخوته', 'Miguel de Cervantes', 'ميغيل دي ثربانتس', 'es', ['classic', 'adventure'], 1605),
  B('it1', 'The Divine Comedy', 'الكوميديا الإلهية', 'Dante Alighieri', 'دانتي أليغييري', 'it', ['poetry', 'classic'], 1320),
  B('it2', 'The Name of the Rose', 'اسم الوردة', 'Umberto Eco', 'أومبرتو إيكو', 'it', ['mystery', 'historical-fiction'], 1980),
  B('gr1', 'The Odyssey', 'الأوديسة', 'Homer', 'هوميروس', 'gr', ['classic', 'mythology', 'poetry'], -700),
  B('gr2', 'Zorba the Greek', 'زوربا اليوناني', 'Nikos Kazantzakis', 'نيكوس كازانتزاكيس', 'gr', ['classic'], 1946),
  B('pt1', 'Blindness', 'العمى', 'José Saramago', 'جوزيه ساراماغو', 'pt', ['literary'], 1995),
  B('cz1', 'The Unbearable Lightness of Being', 'كائن لا تحتمل خفته', 'Milan Kundera', 'ميلان كونديرا', 'cz', ['literary', 'philosophy'], 1984),
  B('no1', 'Hunger', 'الجوع', 'Knut Hamsun', 'كنوت هامسون', 'nordic', ['classic'], 1890),
  B('no2', "Sophie's World", 'عالم صوفي', 'Jostein Gaarder', 'جوستاين غاردر', 'nordic', ['philosophy'], 1991),
  // Americas & Africa
  B('us1', 'Moby-Dick', 'موبي ديك', 'Herman Melville', 'هيرمان ملفيل', 'us', ['classic', 'adventure'], 1851),
  B('us2', 'The Old Man and the Sea', 'العجوز والبحر', 'Ernest Hemingway', 'إرنست همنغواي', 'us', ['classic', 'novella'], 1952),
  B('us3', 'The Great Gatsby', 'غاتسبي العظيم', 'F. Scott Fitzgerald', 'ف. سكوت فيتزجيرالد', 'us', ['classic'], 1925),
  B('us4', 'Beloved', 'محبوبة', 'Toni Morrison', 'توني موريسون', 'us', ['literary', 'historical-fiction'], 1987),
  B('us5', 'To Kill a Mockingbird', 'أن تقتل طائرًا بريئًا', 'Harper Lee', 'هاربر لي', 'us', ['classic'], 1960),
  B('la1', 'One Hundred Years of Solitude', 'مئة عام من العزلة', 'Gabriel García Márquez', 'غابرييل غارسيا ماركيز', 'co', ['classic', 'literary'], 1967),
  B('la2', 'Love in the Time of Cholera', 'الحب في زمن الكوليرا', 'Gabriel García Márquez', 'غابرييل غارسيا ماركيز', 'co', ['romance', 'literary'], 1985),
  B('la3', 'Ficciones', 'خيالات', 'Jorge Luis Borges', 'خورخي لويس بورخيس', 'ar-c', ['short-stories'], 1944),
  B('la4', 'Pedro Páramo', 'بيدرو بارامو', 'Juan Rulfo', 'خوان رولفو', 'mx', ['classic', 'novella'], 1955),
  B('la5', 'The Alchemist', 'الخيميائي', 'Paulo Coelho', 'باولو كويلو', 'br', ['contemporary'], 1988),
  B('la6', 'The House of the Spirits', 'بيت الأرواح', 'Isabel Allende', 'إيزابيل الليندي', 'cl', ['literary'], 1982),
  B('af1', 'Things Fall Apart', 'الأشياء تتداعى', 'Chinua Achebe', 'تشينوا أتشيبي', 'ng', ['classic'], 1958),
  B('af2', 'A Grain of Wheat', 'حبة قمح', 'Ngũgĩ wa Thiong’o', 'نغوغي وا ثيونغو', 'ke', ['classic'], 1967),
  B('af3', 'Disgrace', 'العار', 'J. M. Coetzee', 'ج. م. كوتسي', 'za', ['literary'], 1999),
];

/** Does the library already contain this catalogue book (in either language)? */
export function owned(cb: CatalogBook, books: Book[]): boolean {
  const ts = [norm(cb.t[0]), norm(cb.t[1])];
  return books.some((b) => {
    const titles = [b.title, b.originalTitle, ...(b.altTitles || [])].filter(Boolean).map((x) => norm(x!));
    return titles.some((x) => ts.some((t) => t.length > 3 && (x === t || x.includes(t) || t.includes(x) && x.length > 6)));
  });
}

export interface RankedRec { cb: CatalogBook; score: number; reason: 'author' | 'country' | 'genre' | 'classic' }

export function rankCatalog(books: Book[], exclude: Set<string>): RankedRec[] {
  const w = { author: new Map<string, number>(), country: new Map<string, number>(), genre: new Map<string, number>() };
  for (const b of books) {
    const k = (b.favorite ? 3 : 0) + ((b.rating || 0) >= 4 ? 2 : 0) + (b.status === 'completed' ? 2 : 0) + (b.status === 'reading' ? 1 : 0) + 0.3;
    b.authors.forEach((a) => w.author.set(norm(a), (w.author.get(norm(a)) || 0) + k));
    b.countries.forEach((c) => w.country.set(c, (w.country.get(c) || 0) + k));
    b.genres.forEach((g) => w.genre.set(g, (w.genre.get(g) || 0) + k));
  }
  const out: RankedRec[] = [];
  for (const cb of CATALOG) {
    if (exclude.has(cb.id) || owned(cb, books)) continue;
    const au = Math.max(w.author.get(norm(cb.a[0])) || 0, w.author.get(norm(cb.a[1])) || 0);
    const co = w.country.get(cb.c) || 0;
    const ge = cb.g.reduce((s, g) => s + (w.genre.get(g) || 0), 0);
    const score = au * 3 + co * 1.5 + ge * 0.6 + (cb.g.includes('classic') ? 0.5 : 0);
    const reason = au ? 'author' : co ? 'country' : ge ? 'genre' : 'classic';
    out.push({ cb, score, reason });
  }
  return out.sort((a, b) => b.score - a.score);
}

export interface OnlineRec { key: string; title: string; author: string; year?: number; cover?: string; because: string }

/** More works by authors you love, from Open Library (needs network; not available inside Claude). */
export async function moreByAuthors(books: Book[], authors: string[]): Promise<OnlineRec[]> {
  const out: OnlineRec[] = [];
  const have = new Set(books.map((b) => norm(b.title)));
  for (const a of authors.slice(0, 4)) {
    try {
      const r = await fetch(`https://openlibrary.org/search.json?author=${encodeURIComponent(a)}&sort=editions&limit=12&fields=key,title,author_name,first_publish_year,cover_i`);
      if (!r.ok) continue;
      const j = await r.json();
      for (const d of j.docs || []) {
        if (!d.title || have.has(norm(d.title)) || out.some((o) => norm(o.title) === norm(d.title))) continue;
        out.push({ key: d.key, title: d.title, author: d.author_name?.[0] || a, year: d.first_publish_year, cover: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : undefined, because: a });
        if (out.filter((o) => o.because === a).length >= 5) break;
      }
    } catch { /* offline or blocked */ }
  }
  return out;
}
