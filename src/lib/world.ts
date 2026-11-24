// Geography of literature: regions, countries, and short literary overviews.
export type RegionId =
  | 'east-asia' | 'south-asia' | 'southeast-asia' | 'central-asia' | 'middle-east'
  | 'western-europe' | 'eastern-europe' | 'russia-eurasia' | 'north-africa' | 'subsaharan-africa'
  | 'north-america' | 'latin-america' | 'oceania';

export type Continent = 'asia' | 'europe' | 'africa' | 'north-america' | 'south-america' | 'oceania';

export const continents: { id: Continent; en: string; ar: string }[] = [
  { id: 'asia', en: 'Asia', ar: 'آسيا' },
  { id: 'europe', en: 'Europe', ar: 'أوروبا' },
  { id: 'africa', en: 'Africa', ar: 'أفريقيا' },
  { id: 'north-america', en: 'North America', ar: 'أمريكا الشمالية' },
  { id: 'south-america', en: 'Latin & South America', ar: 'أمريكا اللاتينية والجنوبية' },
  { id: 'oceania', en: 'Oceania', ar: 'أوقيانوسيا' },
];

export const regions: { id: RegionId; en: string; ar: string; continent: Continent }[] = [
  { id: 'east-asia', en: 'East Asia', ar: 'شرق آسيا', continent: 'asia' },
  { id: 'south-asia', en: 'South Asia', ar: 'جنوب آسيا', continent: 'asia' },
  { id: 'southeast-asia', en: 'Southeast Asia', ar: 'جنوب شرق آسيا', continent: 'asia' },
  { id: 'central-asia', en: 'Central Asia', ar: 'آسيا الوسطى', continent: 'asia' },
  { id: 'middle-east', en: 'Middle East', ar: 'الشرق الأوسط', continent: 'asia' },
  { id: 'western-europe', en: 'Europe', ar: 'أوروبا', continent: 'europe' },
  { id: 'eastern-europe', en: 'Eastern Europe', ar: 'أوروبا الشرقية', continent: 'europe' },
  { id: 'russia-eurasia', en: 'Russia & Eurasia', ar: 'روسيا وأوراسيا', continent: 'europe' },
  { id: 'north-africa', en: 'North Africa', ar: 'شمال أفريقيا', continent: 'africa' },
  { id: 'subsaharan-africa', en: 'Sub-Saharan Africa', ar: 'أفريقيا جنوب الصحراء', continent: 'africa' },
  { id: 'north-america', en: 'North America', ar: 'أمريكا الشمالية', continent: 'north-america' },
  { id: 'latin-america', en: 'Latin & South America', ar: 'أمريكا اللاتينية والجنوبية', continent: 'south-america' },
  { id: 'oceania', en: 'Oceania', ar: 'أوقيانوسيا', continent: 'oceania' },
];

export interface Country {
  id: string;
  en: string; ar: string; // country name
  lit: { en: string; ar: string }; // literature name
  regions: RegionId[];
  flag: string;
  keys: string[]; // folder-name keywords (lowercase)
}

const c = (id: string, en: string, ar: string, litEn: string, litAr: string, regionsList: RegionId[], flag: string, keys: string[] = []): Country =>
  ({ id, en, ar, lit: { en: litEn, ar: litAr }, regions: regionsList, flag, keys: [en.toLowerCase(), ar, litEn.toLowerCase(), litAr, ...keys] });

export const countries: Country[] = [
  c('ru', 'Russia', 'روسيا', 'Russian Literature', 'الأدب الروسي', ['russia-eurasia'], '🇷🇺', ['russian', 'روسي', 'روسية', 'الروسي', 'الروسية']),
  c('ua', 'Ukraine', 'أوكرانيا', 'Ukrainian Literature', 'الأدب الأوكراني', ['eastern-europe'], '🇺🇦', ['ukrainian', 'أوكراني']),
  c('pl', 'Poland', 'بولندا', 'Polish Literature', 'الأدب البولندي', ['eastern-europe'], '🇵🇱', ['polish', 'بولندي']),
  c('cz', 'Czechia', 'التشيك', 'Czech Literature', 'الأدب التشيكي', ['eastern-europe'], '🇨🇿', ['czech', 'تشيكي']),
  c('hu', 'Hungary', 'المجر', 'Hungarian Literature', 'الأدب المجري', ['eastern-europe'], '🇭🇺', ['hungarian', 'مجري']),
  c('ro', 'Romania', 'رومانيا', 'Romanian Literature', 'الأدب الروماني', ['eastern-europe'], '🇷🇴', ['romanian']),
  c('rs', 'Balkans', 'البلقان', 'Balkan Literature', 'أدب البلقان', ['eastern-europe'], '🏔️', ['balkan', 'serbian', 'bosnian', 'albanian', 'ألباني', 'صربي']),
  c('jp', 'Japan', 'اليابان', 'Japanese Literature', 'الأدب الياباني', ['east-asia'], '🇯🇵', ['japanese', 'ياباني', 'اليابانية', 'الياباني']),
  c('cn', 'China', 'الصين', 'Chinese Literature', 'الأدب الصيني', ['east-asia'], '🇨🇳', ['chinese', 'صيني', 'الصيني']),
  c('kr', 'Korea', 'كوريا', 'Korean Literature', 'الأدب الكوري', ['east-asia'], '🇰🇷', ['korean', 'كوري', 'الكوري']),
  c('in', 'India', 'الهند', 'Indian Literature', 'الأدب الهندي', ['south-asia'], '🇮🇳', ['indian', 'هندي', 'الهندي']),
  c('pk', 'Pakistan', 'باكستان', 'Pakistani Literature', 'الأدب الباكستاني', ['south-asia'], '🇵🇰', ['urdu', 'أوردو']),
  c('ir', 'Iran', 'إيران', 'Persian Literature', 'الأدب الفارسي', ['middle-east'], '🇮🇷', ['persian', 'فارسي', 'الفارسي', 'farsi']),
  c('af', 'Afghanistan', 'أفغانستان', 'Afghan Literature', 'الأدب الأفغاني', ['central-asia', 'south-asia'], '🇦🇫', ['afghan', 'أفغاني']),
  c('uz', 'Central Asia', 'آسيا الوسطى', 'Central Asian Literature', 'أدب آسيا الوسطى', ['central-asia'], '🏜️', ['kyrgyz', 'kazakh', 'uzbek', 'قرغيزي', 'كازاخي']),
  c('vn', 'Vietnam', 'فيتنام', 'Vietnamese Literature', 'الأدب الفيتنامي', ['southeast-asia'], '🇻🇳', ['vietnamese']),
  c('id', 'Indonesia', 'إندونيسيا', 'Indonesian Literature', 'الأدب الإندونيسي', ['southeast-asia'], '🇮🇩', ['indonesian']),
  c('ph', 'Philippines', 'الفلبين', 'Philippine Literature', 'الأدب الفلبيني', ['southeast-asia'], '🇵🇭', ['filipino']),
  c('tr', 'Turkey', 'تركيا', 'Turkish Literature', 'الأدب التركي', ['middle-east', 'western-europe'], '🇹🇷', ['turkish', 'تركي', 'التركي']),
  c('arab', 'Arab World', 'العالم العربي', 'Arabic Literature', 'الأدب العربي', ['middle-east', 'north-africa'], '📜', ['arabic', 'arab', 'عربي', 'العربي', 'العربية']),
  c('sa', 'Saudi Arabia', 'السعودية', 'Saudi Literature', 'الأدب السعودي', ['middle-east'], '🇸🇦', ['saudi', 'سعودي']),
  c('iq', 'Iraq', 'العراق', 'Iraqi Literature', 'الأدب العراقي', ['middle-east'], '🇮🇶', ['iraqi', 'عراقي']),
  c('sy', 'Syria', 'سوريا', 'Syrian Literature', 'الأدب السوري', ['middle-east'], '🇸🇾', ['syrian', 'سوري']),
  c('lb', 'Lebanon', 'لبنان', 'Lebanese Literature', 'الأدب اللبناني', ['middle-east'], '🇱🇧', ['lebanese', 'لبناني']),
  c('ps', 'Palestine', 'فلسطين', 'Palestinian Literature', 'الأدب الفلسطيني', ['middle-east'], '🇵🇸', ['palestinian', 'فلسطيني']),
  c('eg', 'Egypt', 'مصر', 'Egyptian Literature', 'الأدب المصري', ['north-africa', 'middle-east'], '🇪🇬', ['egyptian', 'مصري', 'المصري']),
  c('sd', 'Sudan', 'السودان', 'Sudanese Literature', 'الأدب السوداني', ['north-africa', 'subsaharan-africa'], '🇸🇩', ['sudanese', 'سوداني', 'السوداني']),
  c('ma', 'Maghreb', 'المغرب العربي', 'Maghrebi Literature', 'أدب المغرب العربي', ['north-africa'], '🇲🇦', ['moroccan', 'algerian', 'tunisian', 'libyan', 'مغربي', 'جزائري', 'تونسي', 'ليبي', 'الجزائر', 'تونس', 'ليبيا', 'المغرب']),
  c('ng', 'Nigeria', 'نيجيريا', 'Nigerian Literature', 'الأدب النيجيري', ['subsaharan-africa'], '🇳🇬', ['nigerian', 'نيجيري']),
  c('ke', 'East Africa', 'شرق أفريقيا', 'East African Literature', 'أدب شرق أفريقيا', ['subsaharan-africa'], '🌍', ['kenyan', 'ethiopian', 'somali', 'tanzanian', 'كيني', 'إثيوبي', 'صومالي']),
  c('za', 'South Africa', 'جنوب أفريقيا', 'South African Literature', 'أدب جنوب أفريقيا', ['subsaharan-africa'], '🇿🇦', ['south african']),
  c('af-other', 'Africa (other)', 'أفريقيا (أخرى)', 'African Literature', 'الأدب الأفريقي', ['subsaharan-africa'], '🌍', ['african', 'أفريقي', 'الأفريقي']),
  c('fr', 'France', 'فرنسا', 'French Literature', 'الأدب الفرنسي', ['western-europe'], '🇫🇷', ['french', 'فرنسي', 'الفرنسي']),
  c('de', 'Germany', 'ألمانيا', 'German Literature', 'الأدب الألماني', ['western-europe'], '🇩🇪', ['german', 'ألماني', 'الألماني', 'austrian', 'نمساوي']),
  c('gb', 'Britain & Ireland', 'بريطانيا وأيرلندا', 'British Literature', 'الأدب البريطاني', ['western-europe'], '🇬🇧', ['british', 'english literature', 'irish', 'scottish', 'بريطاني', 'إنجليزي', 'الإنجليزي', 'أيرلندي']),
  c('it', 'Italy', 'إيطاليا', 'Italian Literature', 'الأدب الإيطالي', ['western-europe'], '🇮🇹', ['italian', 'إيطالي']),
  c('es', 'Spain', 'إسبانيا', 'Spanish Literature', 'الأدب الإسباني', ['western-europe'], '🇪🇸', ['spanish', 'إسباني', 'الإسباني']),
  c('pt', 'Portugal', 'البرتغال', 'Portuguese Literature', 'الأدب البرتغالي', ['western-europe'], '🇵🇹', ['portuguese', 'برتغالي']),
  c('gr', 'Greece', 'اليونان', 'Greek Literature', 'الأدب اليوناني', ['western-europe'], '🇬🇷', ['greek', 'يوناني', 'الإغريقي']),
  c('nordic', 'Nordic Countries', 'دول الشمال', 'Scandinavian Literature', 'الأدب الإسكندنافي', ['western-europe'], '❄️', ['scandinavian', 'norwegian', 'swedish', 'danish', 'finnish', 'icelandic', 'إسكندنافي', 'نرويجي', 'سويدي']),
  c('us', 'United States', 'الولايات المتحدة', 'American Literature', 'الأدب الأمريكي', ['north-america'], '🇺🇸', ['american', 'أمريكي', 'الأمريكي']),
  c('ca', 'Canada', 'كندا', 'Canadian Literature', 'الأدب الكندي', ['north-america'], '🇨🇦', ['canadian', 'كندي']),
  c('latam', 'Latin America', 'أمريكا اللاتينية', 'Latin American Literature', 'أدب أمريكا اللاتينية', ['latin-america'], '🌎', ['latin american', 'لاتيني', 'اللاتينية', 'أمريكا الجنوبية']),
  c('mx', 'Mexico', 'المكسيك', 'Mexican Literature', 'الأدب المكسيكي', ['latin-america', 'north-america'], '🇲🇽', ['mexican', 'مكسيكي']),
  c('co', 'Colombia', 'كولومبيا', 'Colombian Literature', 'الأدب الكولومبي', ['latin-america'], '🇨🇴', ['colombian', 'كولومبي']),
  c('ar-c', 'Argentina', 'الأرجنتين', 'Argentine Literature', 'الأدب الأرجنتيني', ['latin-america'], '🇦🇷', ['argentine', 'argentinian', 'أرجنتيني']),
  c('br', 'Brazil', 'البرازيل', 'Brazilian Literature', 'الأدب البرازيلي', ['latin-america'], '🇧🇷', ['brazilian', 'برازيلي']),
  c('cl', 'Chile & Peru', 'تشيلي والبيرو', 'Andean Literature', 'أدب تشيلي والبيرو', ['latin-america'], '🇨🇱', ['chilean', 'peruvian', 'تشيلي', 'بيرو']),
  c('au', 'Australia & NZ', 'أستراليا ونيوزيلندا', 'Australian & NZ Literature', 'أدب أستراليا ونيوزيلندا', ['oceania'], '🇦🇺', ['australian', 'new zealand', 'أسترالي']),
];

export const countryById = (id: string) => countries.find((x) => x.id === id);

export function continentOf(id: string): Continent | undefined {
  const co = countryById(id);
  if (!co) return undefined;
  return regions.find((r) => r.id === co.regions[0])?.continent;
}

/** Match a folder name like "الأدب الروسي" or "Russian literature" to a country. */
export function matchCountryFromName(name: string): string | undefined {
  const n = name.toLowerCase().replace(/[_\-.]+/g, ' ').trim();
  let best: { id: string; len: number } | undefined;
  for (const co of countries) {
    for (const k of co.keys) {
      if (k.length >= 4 && n.includes(k)) {
        if (!best || k.length > best.len) best = { id: co.id, len: k.length };
      }
    }
  }
  return best?.id;
}

interface Overview { en: string; ar: string; periods: { en: string; ar: string }; writers: { en: string; ar: string }; forms: { en: string; ar: string } }

export const overviews: Record<string, Overview> = {
  ru: {
    en: 'Russian prose came of age in the nineteenth century, when the novel became the country’s great vehicle for moral and philosophical questions. After 1917 literature lived under censorship, in emigration, and in samizdat, yet produced some of the twentieth century’s most searching books.',
    ar: 'نضج النثر الروسي في القرن التاسع عشر حين صارت الرواية الوسيلة الكبرى لطرح الأسئلة الأخلاقية والفلسفية. وبعد ١٩١٧ عاش الأدب تحت الرقابة وفي المنفى وفي «الساميزدات»، ومع ذلك أنتج بعضًا من أعمق كتب القرن العشرين.',
    periods: { en: 'Golden Age (19th c.) · Silver Age (c. 1890–1920) · Soviet era · Emigré & dissident writing', ar: 'العصر الذهبي (القرن ١٩) · العصر الفضي (نحو ١٨٩٠–١٩٢٠) · الحقبة السوفيتية · أدب المهجر والمعارضة' },
    writers: { en: 'Pushkin, Gogol, Dostoevsky, Tolstoy, Chekhov, Bulgakov, Pasternak, Solzhenitsyn', ar: 'بوشكين، غوغول، دوستويفسكي، تولستوي، تشيخوف، بولغاكوف، باسترناك، سولجنيتسين' },
    forms: { en: 'Philosophical novel, short story, drama, lyric poetry', ar: 'الرواية الفلسفية، القصة القصيرة، المسرح، الشعر الغنائي' },
  },
  jp: {
    en: 'Japanese literature runs from classical court writing — including The Tale of Genji, often called the world’s first novel — through haiku and Edo-period fiction to modern novels that meet Western forms with a distinctly Japanese restraint.',
    ar: 'يمتد الأدب الياباني من كتابات البلاط الكلاسيكية — ومنها «حكاية غينجي» التي تُعدّ كثيرًا أول رواية في العالم — مرورًا بالهايكو وقصص عصر إيدو، وصولًا إلى روايات حديثة تلتقي فيها الأشكال الغربية بتحفّظ ياباني خاص.',
    periods: { en: 'Heian (794–1185) · Edo (1603–1868) · Meiji modernisation · Postwar', ar: 'هييان (٧٩٤–١١٨٥) · إيدو (١٦٠٣–١٨٦٨) · تحديث ميجي · ما بعد الحرب' },
    writers: { en: 'Murasaki Shikibu, Bashō, Natsume Sōseki, Akutagawa, Kawabata, Mishima, Ōe, Murakami', ar: 'موراساكي شيكيبو، باشو، ناتسومي سوسيكي، أكوتاغاوا، كاواباتا، ميشيما، أوي، موراكامي' },
    forms: { en: 'Monogatari tale, haiku, I-novel, short fiction', ar: 'حكايات المونوغاتاري، الهايكو، رواية الأنا، القصة القصيرة' },
  },
  cn: {
    en: 'One of the oldest continuous literary traditions, Chinese literature spans the classical poetry of the Tang dynasty, the four great classical novels of the Ming and Qing, and the modern vernacular writing that began with the May Fourth Movement of 1919.',
    ar: 'من أقدم التقاليد الأدبية المتصلة؛ يمتد الأدب الصيني من شعر سلالة تانغ الكلاسيكي إلى الروايات الكلاسيكية الأربع الكبرى في عهدي مينغ وتشينغ، ثم الكتابة الحديثة بالعامية التي بدأت مع حركة الرابع من مايو ١٩١٩.',
    periods: { en: 'Classical era · Tang poetry · Ming–Qing novel · May Fourth & modern', ar: 'العصر الكلاسيكي · شعر تانغ · رواية مينغ وتشينغ · الرابع من مايو والحديث' },
    writers: { en: 'Li Bai, Du Fu, Cao Xueqin, Lu Xun, Eileen Chang, Mo Yan, Yu Hua', ar: 'لي باي، دو فو، تساو شيويه تشين، لو شون، آيلين تشانغ، مو يان، يو هوا' },
    forms: { en: 'Classical poetry, vernacular novel, essay', ar: 'الشعر الكلاسيكي، الرواية العامية، المقالة' },
  },
  kr: {
    en: 'Korean literature moved from classical writing in Chinese characters to works in Hangul, and in the twentieth century was shaped by colonisation, war and division. Contemporary Korean fiction is now widely translated; Han Kang received the Nobel Prize in Literature in 2024.',
    ar: 'انتقل الأدب الكوري من الكتابة الكلاسيكية بالحروف الصينية إلى الكتابة بأبجدية الهانغول، وتشكّل في القرن العشرين بفعل الاستعمار والحرب والانقسام. يُترجم الأدب الكوري المعاصر اليوم على نطاق واسع، ونالت هان كانغ جائزة نوبل للآداب عام ٢٠٢٤.',
    periods: { en: 'Joseon era · Colonial period · Post-war & division · Contemporary', ar: 'عصر جوسون · الحقبة الاستعمارية · ما بعد الحرب والانقسام · المعاصر' },
    writers: { en: 'Yi Sang, Park Wan-suh, Hwang Sok-yong, Shin Kyung-sook, Han Kang', ar: 'يي سانغ، باك وان سو، هوانغ سوك يونغ، شين كيونغ سوك، هان كانغ' },
    forms: { en: 'Sijo poetry, novel, short story', ar: 'شعر السيجو، الرواية، القصة القصيرة' },
  },
  in: {
    en: 'Indian literature is many literatures: Sanskrit epics, classical Tamil poetry, Persian and Urdu verse, and modern writing in more than twenty languages, including a rich body of fiction in English.',
    ar: 'الأدب الهندي آداب كثيرة: ملاحم سنسكريتية، وشعر تاميلي كلاسيكي، وشعر فارسي وأوردي، وكتابة حديثة بأكثر من عشرين لغة، منها نتاج روائي غني بالإنجليزية.',
    periods: { en: 'Vedic & epic · Classical · Bhakti & Mughal · Modern & postcolonial', ar: 'الفيدي والملحمي · الكلاسيكي · البهاكتي والمغولي · الحديث وما بعد الاستعمار' },
    writers: { en: 'Valmiki, Kalidasa, Kabir, Tagore, Premchand, R. K. Narayan, Arundhati Roy', ar: 'فالميكي، كاليداسا، كبير، طاغور، بريمشاند، ر. ك. نارايان، أروندهاتي روي' },
    forms: { en: 'Epic, devotional poetry, ghazal, novel', ar: 'الملحمة، الشعر الصوفي، الغزل، الرواية' },
  },
  ir: {
    en: 'Persian literature is above all a poetic tradition — epic, mystical and lyric — whose classics are still memorised and quoted across Iran, Afghanistan and Central Asia. Modern Persian fiction emerged in the twentieth century.',
    ar: 'الأدب الفارسي قبل كل شيء تقليد شعري — ملحمي وصوفي وغنائي — ما تزال كلاسيكياته تُحفظ وتُستشهد بها في إيران وأفغانستان وآسيا الوسطى. وظهر القص الفارسي الحديث في القرن العشرين.',
    periods: { en: 'Classical (10th–15th c.) · Safavid · Modern', ar: 'الكلاسيكي (القرن ١٠–١٥) · الصفوي · الحديث' },
    writers: { en: 'Ferdowsi, Omar Khayyam, Rumi, Saadi, Hafez, Sadegh Hedayat, Forough Farrokhzad', ar: 'الفردوسي، عمر الخيام، جلال الدين الرومي، سعدي، حافظ، صادق هدايت، فروغ فرخزاد' },
    forms: { en: 'Epic, ghazal, rubāʿī quatrain, mathnawi', ar: 'الملحمة، الغزل، الرباعيات، المثنوي' },
  },
  arab: {
    en: 'Arabic literature begins with pre-Islamic poetry and is shaped by the Qur’an’s language. The Abbasid era brought adab prose and the maqāma; the nineteenth-century Nahda renewed it, and the modern Arabic novel flourished from Cairo to Beirut, Baghdad and Khartoum.',
    ar: 'يبدأ الأدب العربي بالشعر الجاهلي ويتشكل بلغة القرآن الكريم. وجاء العصر العباسي بنثر الأدب وفن المقامة، ثم جدّدته النهضة في القرن التاسع عشر، وازدهرت الرواية العربية الحديثة من القاهرة إلى بيروت وبغداد والخرطوم.',
    periods: { en: 'Pre-Islamic · Umayyad & Abbasid · Andalusian · Nahda · Modern', ar: 'الجاهلي · الأموي والعباسي · الأندلسي · النهضة · الحديث' },
    writers: { en: 'Imru’ al-Qais, al-Mutanabbi, al-Jahiz, Naguib Mahfouz, Tayeb Salih, Mahmoud Darwish', ar: 'امرؤ القيس، المتنبي، الجاحظ، نجيب محفوظ، الطيب صالح، محمود درويش' },
    forms: { en: 'Qasida, maqāma, adab prose, novel', ar: 'القصيدة، المقامة، نثر الأدب، الرواية' },
  },
  sd: {
    en: 'Sudanese writing joins Arabic and African traditions, with strong oral poetry and a modern fiction that reached world readers through Tayeb Salih’s Season of Migration to the North.',
    ar: 'تجمع الكتابة السودانية بين التقاليد العربية والأفريقية، ولها شعر شفهي قوي، ورواية حديثة بلغت القراء في العالم عبر «موسم الهجرة إلى الشمال» للطيب صالح.',
    periods: { en: 'Oral & Sufi poetry · Post-independence · Contemporary', ar: 'الشعر الشفهي والصوفي · ما بعد الاستقلال · المعاصر' },
    writers: { en: 'Tayeb Salih, Muhammad al-Faytouri, Leila Aboulela, Amir Tag Elsir, Hammour Ziada', ar: 'الطيب صالح، محمد الفيتوري، ليلى أبو العلا، أمير تاج السر، حمّور زيادة' },
    forms: { en: 'Poetry, novel, short story', ar: 'الشعر، الرواية، القصة القصيرة' },
  },
  eg: {
    en: 'Egypt has been a centre of modern Arabic letters since the Nahda, home to the first modern Arabic novels, a vast publishing industry, and the first Arab Nobel laureate in literature, Naguib Mahfouz (1988).',
    ar: 'كانت مصر مركزًا للأدب العربي الحديث منذ النهضة، وفيها ظهرت أولى الروايات العربية الحديثة وصناعة نشر واسعة، ومنها أول عربي ينال نوبل للآداب: نجيب محفوظ (١٩٨٨).',
    periods: { en: 'Nahda · Interwar modernism · 1960s generation · Contemporary', ar: 'النهضة · الحداثة بين الحربين · جيل الستينيات · المعاصر' },
    writers: { en: 'Taha Hussein, Tawfiq al-Hakim, Naguib Mahfouz, Yusuf Idris, Radwa Ashour', ar: 'طه حسين، توفيق الحكيم، نجيب محفوظ، يوسف إدريس، رضوى عاشور' },
    forms: { en: 'Novel, short story, drama, essay', ar: 'الرواية، القصة القصيرة، المسرح، المقالة' },
  },
  tr: {
    en: 'Turkish literature moved from Ottoman court poetry and folk minstrel traditions to a modern literature written in the reformed Turkish language after 1928; Orhan Pamuk received the Nobel Prize in 2006.',
    ar: 'انتقل الأدب التركي من شعر البلاط العثماني وتقاليد الشعراء الشعبيين الجوالين إلى أدب حديث يُكتب بالتركية المُصلَحة بعد ١٩٢٨، ونال أورهان باموق جائزة نوبل عام ٢٠٠٦.',
    periods: { en: 'Ottoman divan · Tanzimat · Republican · Contemporary', ar: 'الديوان العثماني · التنظيمات · الجمهوري · المعاصر' },
    writers: { en: 'Yunus Emre, Nazım Hikmet, Sabahattin Ali, Yaşar Kemal, Orhan Pamuk, Elif Shafak', ar: 'يونس إمره، ناظم حكمت، صباح الدين علي، يشار كمال، أورهان باموق، إليف شافاق' },
    forms: { en: 'Divan poetry, folk poetry, novel', ar: 'شعر الديوان، الشعر الشعبي، الرواية' },
  },
  fr: {
    en: 'French literature has repeatedly set the terms for European writing — from medieval romance and Renaissance essays to classical drama, Enlightenment philosophy, the realist novel, and twentieth-century existentialism.',
    ar: 'حدّد الأدب الفرنسي مرارًا مسار الكتابة الأوروبية — من الرومانس الوسيط ومقالات النهضة إلى المسرح الكلاسيكي وفلسفة التنوير والرواية الواقعية ووجودية القرن العشرين.',
    periods: { en: 'Renaissance · Classicism · Enlightenment · Realism & Naturalism · Modern', ar: 'النهضة · الكلاسيكية · التنوير · الواقعية والطبيعية · الحديث' },
    writers: { en: 'Montaigne, Molière, Voltaire, Hugo, Balzac, Flaubert, Proust, Camus', ar: 'مونتين، موليير، فولتير، هوغو، بلزاك، فلوبير، بروست، كامو' },
    forms: { en: 'Essay, drama, realist novel, poetry', ar: 'المقالة، المسرح، الرواية الواقعية، الشعر' },
  },
  de: {
    en: 'German-language literature — from Germany, Austria and Switzerland — produced Weimar Classicism and Romanticism, the philosophical novel, and modernist masters writing in Prague and Vienna.',
    ar: 'أنتج الأدب المكتوب بالألمانية — في ألمانيا والنمسا وسويسرا — كلاسيكية فايمار والرومانسية والرواية الفلسفية، وأساتذة الحداثة الذين كتبوا في براغ وفيينا.',
    periods: { en: 'Sturm und Drang · Weimar Classicism · Romanticism · Modernism · Postwar', ar: 'العاصفة والاندفاع · كلاسيكية فايمار · الرومانسية · الحداثة · ما بعد الحرب' },
    writers: { en: 'Goethe, Schiller, Heine, Thomas Mann, Kafka, Hesse, Rilke, Günter Grass', ar: 'غوته، شيلر، هاينه، توماس مان، كافكا، هيسه، ريلكه، غونتر غراس' },
    forms: { en: 'Bildungsroman, lyric poetry, novella', ar: 'رواية التكوين، الشعر الغنائي، النوفيلا' },
  },
  gb: {
    en: 'Literature from Britain and Ireland runs from Chaucer and Shakespeare through the Romantic poets and the Victorian novel to modernism and today’s diverse fiction in English.',
    ar: 'يمتد أدب بريطانيا وأيرلندا من تشوسر وشكسبير، مرورًا بالشعراء الرومانسيين والرواية الفيكتورية، إلى الحداثة والقص الإنجليزي المتنوع اليوم.',
    periods: { en: 'Medieval · Elizabethan · Romantic · Victorian · Modernist · Contemporary', ar: 'الوسيط · الإليزابيثي · الرومانسي · الفيكتوري · الحداثي · المعاصر' },
    writers: { en: 'Chaucer, Shakespeare, Jane Austen, Dickens, the Brontës, Joyce, Virginia Woolf, Orwell', ar: 'تشوسر، شكسبير، جين أوستن، ديكنز، الأخوات برونتي، جويس، فرجينيا وولف، أورويل' },
    forms: { en: 'Drama, novel, lyric poetry, essay', ar: 'المسرح، الرواية، الشعر الغنائي، المقالة' },
  },
  us: {
    en: 'American literature grew from colonial writing into a national voice in the nineteenth century, then shaped the twentieth century through modernism, the Harlem Renaissance, Southern fiction and a wide range of immigrant and minority voices.',
    ar: 'نشأ الأدب الأمريكي من الكتابة الاستعمارية وصار صوتًا وطنيًا في القرن التاسع عشر، ثم شكّل القرن العشرين عبر الحداثة ونهضة هارلم وأدب الجنوب وأصوات المهاجرين والأقليات المتنوعة.',
    periods: { en: 'American Renaissance · Realism · Modernism · Postwar · Contemporary', ar: 'النهضة الأمريكية · الواقعية · الحداثة · ما بعد الحرب · المعاصر' },
    writers: { en: 'Melville, Whitman, Emily Dickinson, Mark Twain, Faulkner, Hemingway, Toni Morrison', ar: 'ملفيل، ويتمان، إميلي ديكنسون، مارك توين، فوكنر، همنغواي، توني موريسون' },
    forms: { en: 'Novel, short story, free verse', ar: 'الرواية، القصة القصيرة، الشعر الحر' },
  },
  latam: {
    en: 'Latin American literature, written mostly in Spanish and Portuguese, gained world attention with the 1960s “Boom” and magical realism, building on a long tradition of poetry and the short story.',
    ar: 'لفت أدب أمريكا اللاتينية — المكتوب غالبًا بالإسبانية والبرتغالية — أنظار العالم مع «الطفرة» في ستينيات القرن العشرين والواقعية السحرية، مستندًا إلى تقليد طويل في الشعر والقصة القصيرة.',
    periods: { en: 'Modernismo · Vanguards · The Boom (1960s–70s) · Post-Boom', ar: 'الحداثية · الطليعيات · الطفرة (الستينيات والسبعينيات) · ما بعد الطفرة' },
    writers: { en: 'Rubén Darío, Borges, Neruda, García Márquez, Cortázar, Vargas Llosa, Clarice Lispector', ar: 'روبين داريو، بورخيس، نيرودا، غارسيا ماركيز، كورتاثار، فارغاس يوسا، كلاريس ليسبكتور' },
    forms: { en: 'Short story, magical realism, poetry', ar: 'القصة القصيرة، الواقعية السحرية، الشعر' },
  },
};

export function countryName(id: string, lang: 'en' | 'ar') {
  const co = countryById(id);
  return co ? co[lang] : id;
}
export function litName(id: string, lang: 'en' | 'ar') {
  const co = countryById(id);
  return co ? co.lit[lang] : id;
}
