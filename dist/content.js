window.MGTU_DEFAULTS = {
 title: 'День открытых\nдверей в МГТУ', description:'Посмотри, как устроен университет, узнай о направлениях и задай вопросы о поступлении.',
 date:'Дата и время — скоро', place:'Майкоп · МГТУ',phone:'8 (8772) 52-30-08',email:'priemkom@mkgtu.ru',accent:'#e9d8fd',secondary:'#a7c7ff',background:'#0b2a4a',font:'Steppe',brandVersion:2,
 sections:{about:true,discover:true,programs:true,plan:true,resources:true,faq:true}, programs:{}, texts:{aboutTitle:'Больше, чем учёба.',programsTitle:'Кем ты хочешь стать?',resourcesTitle:'Меньше вопросов. Больше ясности.',planDescription:'Выбери направления, которые хочешь обсудить, зарегистрируйся на встречу и скачай памятку. Отмечай, что уже сделано.'},
 checklist:['Выбрать интересные направления','Сравнить программы и сохранить вопросы','Зарегистрироваться на день открытых дверей','Скачать памятку абитуриента','Обсудить поступление с приёмной комиссией']
};
window.MGTU_read = (key,fallback) => { try {return JSON.parse(localStorage.getItem(key)) ?? fallback;} catch{return fallback;} };
window.MGTU_write = (key,value) => {try {localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}};
window.MGTU_content = () => {const s=MGTU_read('mgtu-content',{});if(s.title==='Твоё завтра\nначинается\nздесь.')delete s.title;if(s.description==='Познакомься с университетом, найди своё направление и сделай первый шаг к большому будущему.')delete s.description;if(s.texts){for(const key of ['aboutTitle','programsTitle','resourcesTitle'])if(typeof s.texts[key]==='string')s.texts[key]=s.texts[key].replace(/\s+/g,' ').trim();if(s.texts.planDescription==='Маленькие шаги к большому решению.\nОтмечай сделанное — твой список сохранится\nна этом устройстве.')delete s.texts.planDescription;}if(!s.brandVersion){for(const [key,old] of Object.entries({accent:'#d8fa69',secondary:'#b7b0f5',background:'#161c1b',font:'Manrope'})){if(s[key]===old)delete s[key];}}return {...MGTU_DEFAULTS,...s,sections:{...MGTU_DEFAULTS.sections,...s.sections},programs:{...s.programs},texts:{...MGTU_DEFAULTS.texts,...s.texts}};};
window.MGTU_PALETTES = {
 technology:{name:'Технологии',colors:['#0B2A4A','#1E3A8A','#3BB2F6','#A7C7FF','#E6EEF7']},
 medicine:{name:'Медицина',colors:['#0F766E','#14BBA6','#67E8F9','#A7F3D0','#E6FBF5']},
 culture:{name:'Креатив и сервис',colors:['#5B3E2D','#8B5E3C','#D4A574','#EFDCC8','#F9C4A8']},
 architecture:{name:'Архитектура',colors:['#1F2937','#475569','#94A3B8','#C8D5E1','#F1F5F9']},
 admissions:{name:'Экономика и право',colors:['#1F2937','#3B2F8F','#A855F7','#E9D8FD','#F7F7F7']},
 ecology:{name:'Экология',colors:['#0F5132','#4F7D67','#A7B8A8','#E8EFEA']},
 brand:{name:'МГТУ',colors:['#0B2A4A','#1F2937','#6B7179','#790B19','#F7F7F7','#FFB020']}
};
window.MGTU_theme = p => {
 if(/строительство/i.test(p.name))return 'architecture';
 if(/лечеб|стомат|фарма|педиатр/i.test(p.faculty)||/медицин|лечеб|педиат|стомат|фармац/i.test(p.name))return 'medicine';
 if(/реклама|туризм|гостинич|сервис|легкой промышленности/i.test(p.name))return 'culture';
 if(/химия|химическая|информ|безопасност.*систем|информационно/i.test(p.name))return 'technology';
 if(/аграр|эколог/i.test(p.faculty))return 'ecology';
 if(/эконом|юриспруд|менеджмент|муниципал|финансы|таможен/i.test(p.name)||/экономики и управления/i.test(p.faculty))return 'admissions';
 return 'technology';
};
window.MGTU_escape = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
