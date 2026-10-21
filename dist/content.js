window.MGTU_DEFAULTS = {
 title: 'Твоё завтра\nначинается\nздесь.', description:'Познакомься с университетом, найди своё направление и сделай первый шаг к большому будущему.',
 date:'Дата и время — скоро', place:'Майкоп · МГТУ',phone:'8 (8772) 52-30-08',email:'priemkom@mkgtu.ru',accent:'#d8fa69',secondary:'#b7b0f5',background:'#161c1b',font:'Manrope',
 sections:{about:true,discover:true,programs:true,plan:true,resources:true,faq:true}, programs:{}, texts:{},
 checklist:['Выбрать интересные направления','Сравнить программы и сохранить вопросы','Зарегистрироваться на день открытых дверей','Скачать памятку абитуриента','Обсудить поступление с приёмной комиссией']
};
window.MGTU_read = (key,fallback) => { try {return JSON.parse(localStorage.getItem(key)) ?? fallback;} catch{return fallback;} };
window.MGTU_write = (key,value) => {try {localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}};
window.MGTU_content = () => {const s=MGTU_read('mgtu-content',{});return {...MGTU_DEFAULTS,...s,sections:{...MGTU_DEFAULTS.sections,...s.sections},programs:{...s.programs}};};
window.MGTU_escape = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
