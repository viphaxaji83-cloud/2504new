import fs from 'node:fs/promises';
const file=new URL('./dist/app.js',import.meta.url);
let source=await fs.readFile(file,'utf8');
function replace(from,to){if(!source.includes(from))throw Error('Missing replacement: '+from);source=source.replace(from,to);}
replace("$('#contactPhone').href='tel:'+content.phone.replace(/[^+\\d]/g,'');", "$('#contactPhone').href='tel:'+content.phone.replace(/[^+\\d]/g,'').replace(/^8(?=\\d{10}$)/,'+7');");
replace("$('#compareCount').textContent=compared.length;",'');
replace('<b>${compared.length}</b>', '<b id="compareCount">${compared.length}</b>');
replace('Оригинальная карточка программы. Текстовая версия доступна в документе по ссылке ниже.', 'Оригинальная карточка программы с исходного сайта МГТУ.');
replace('${esc(p.document)}', '${esc(p.document||p.image)}');
replace('${esc(p.document||\'https://2504.mkgtu.ru/\')}', '${esc(p.document||p.image)}');
replace('required pattern="[+0-9()\\s\\-]{10,22}" maxlength="22"', 'required inputmode="tel" minlength="10" maxlength="22"');
replace("$('#registrationForm').addEventListener('submit',e=>{e.preventDefault();if(!e.target.reportValidity())return;", "$('#registrationForm').addEventListener('input',e=>{if(e.target.name==='phone')e.target.setCustomValidity('');});\n  $('#registrationForm').addEventListener('submit',e=>{e.preventDefault();const phone=e.target.elements.phone;const digits=phone.value.replace(/\\D/g,'');phone.setCustomValidity(/^[+\\d()\\s-]+$/.test(phone.value)&&digits.length>=10&&digits.length<=15?'':'Введите номер телефона: от 10 до 15 цифр.');if(!e.target.reportValidity())return;");
await fs.writeFile(file,source);
console.log('Fixed comparison state, phone validation, contact link, and missing document fallbacks.');
