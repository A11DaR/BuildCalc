/* BuildCalc Studio. Vanilla JS. Данные остаются в браузере. */
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const fmt=(n,d=1)=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:d}).format(n);
const money=n=>fmt(n,2)+' ₸';
const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>globalThis.crypto?.randomUUID?.()||Date.now()+'-'+Math.random().toString(36).slice(2);
const defaults={paint:{length:5,width:4,height:2.8,openings:4,coats:2,coverage:10,pack:5,price:12500,reserve:10},tile:{length:5,width:4,openings:0,tileL:60,tileW:60,pack:4,price:7200,reserve:10},brick:{length:6,height:2.8,openings:2,brickL:250,brickH:65,joint:10,layers:1,price:160,reserve:5}};
const meta={paint:{name:'Краска',title:'Ваша комната',need:'Нужно краски',icon:'▥'},tile:{name:'Плитка',title:'Ваша поверхность',need:'Нужно плитки',icon:'▦'},brick:{name:'Кирпич',title:'Ваша стена',need:'Нужно кирпичей',icon:'▤'}};
const presets={paint:[['Спальня',4,3,2.7,3],['Гостиная',5,4,2.8,4],['Студия',7,5,3,5]],tile:[['Ванная',2.5,2,0,0],['Кухня',4,3,0,0],['Гостиная',5,4,0,0]],brick:[['Перегородка',4,0,2.7,2],['Стена',6,0,2.8,2],['Гараж',8,0,3,6]]};
let type='paint',params=structuredClone(defaults),result=null,view='iso',turn=0,color='#e89872',editId=null,prices=[3200,6800,12500,23500],packs=null,toastTimer;
const colors=['#e89872','#afc6b1','#d9c9a5','#9eb7ce','#d5c1d6'];
function toast(t){$('#toast').textContent=t;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3400);}
function read(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}}
function write(key,data){try{localStorage.setItem(key,JSON.stringify(data));return true;}catch{toast('Не удалось сохранить в браузере. Скачайте файл проекта.');return false;}}
function restore(raw){
 if(!raw||!meta[raw.type]||!raw.params)throw new Error('Некорректный материал в проекте.');
 const p={};for(const k of Object.keys(defaults[raw.type])){if(typeof raw.params[k]!=='number')throw new Error('Некорректные параметры проекта.');p[k]=raw.params[k];}
 if(raw.type==='brick'&&![1,2].includes(p.layers))throw new Error('Неизвестная толщина кладки.');
 let r=BuildMath.calculate(raw.type,p),mix=null;
 if(raw.mode){if(raw.type!=='paint'||!['cheapest','leastSurplus'].includes(raw.mode))throw new Error('Неизвестный режим подбора.');mix=BuildMath.optimizePaint(r.required,raw.packPrices)[raw.mode];r={...r,cost:mix.cost,count:mix.count,purchased:mix.volume};}
 return{id:String(raw.id||uid()),type:raw.type,params:p,result:r,label:typeof raw.label==='string'?raw.label.slice(0,70):meta[raw.type].name,mode:raw.mode||null,packPrices:mix?[...raw.packPrices]:null,mix};
}
function safeItems(data){return Array.isArray(data)?data.slice(0,100).map(x=>{try{return restore(x);}catch{return null;}}).filter(Boolean):[];}
let draft=read('buildcalc-draft-v1',{});if(!draft||typeof draft!=='object')draft={};
let items=safeItems(draft.items),activeProjectId=typeof draft.projectId==='string'?draft.projectId:null;
let rawProjects=read('buildcalc-projects-v1',[]);
let projects=Array.isArray(rawProjects)?rawProjects.filter(p=>p&&typeof p.name==='string'&&Array.isArray(p.items)).map(p=>({id:String(p.id||uid()),name:p.name.slice(0,70),date:p.date,items:safeItems(p.items),budget:Number.isFinite(p.budget)&&p.budget>=0?p.budget:0})):[];
$('#project-name').value=typeof draft.name==='string'?draft.name.slice(0,70):'';$('#budget').value=Number.isFinite(draft.budget)&&draft.budget>0?draft.budget:'';
const currentBudget=()=>{const n=Number($('#budget').value);return Number.isFinite(n)&&n>=0&&n<=1e12?n:0;};
function persist(){write('buildcalc-draft-v1',{items,name:$('#project-name').value,budget:currentBudget(),projectId:activeProjectId});}
function question(title,message){return new Promise(resolve=>{const d=$('#confirm-dialog');$('#dialog-title').textContent=title;$('#dialog-message').textContent=message;d.returnValue='cancel';const close=()=>{d.removeEventListener('close',close);resolve(d.returnValue==='yes');};d.addEventListener('close',close);d.showModal();});}
$('#cancel-action').onclick=()=>$('#confirm-dialog').close('cancel');$('#confirm-action').onclick=()=>$('#confirm-dialog').close('yes');
function field(key,label,unit,hint='',slider=false){const value=params[type][key];return `<div class="field"><label for="f-${key}">${label}</label><div class="input-wrap"><input id="f-${key}" name="${key}" type="number" inputmode="decimal" min="0" step="${['coats','pack'].includes(key)&&!(type==='paint'&&key==='pack')?'1':'any'}" value="${Number.isFinite(value)?value:''}" required><span>${unit}</span></div>${slider?`<input type="range" min="0.5" max="${key==='height'?6:15}" step="0.1" value="${Number.isFinite(value)?value:1}" data-slider="${key}" aria-label="${label}, ползунок">`:''}${hint?`<p class="hint">${hint}</p>`:''}</div>`;}
function group(title,fields,three=false){return `<div class="group-title">${title}</div><div class="fields-grid ${three?'three':''}">${fields}</div>`;}
function renderForm(){
 $('#form-title').textContent=meta[type].title;
 $$('[data-material]').forEach(b=>{const active=b.dataset.material===type;b.classList.toggle('active',active);b.setAttribute('aria-pressed',active);});
 $('#presets').innerHTML=presets[type].map((p,i)=>`<button data-preset="${i}">${p[0]} ↗</button>`).join('');
 let html='';
 if(type==='paint'){
  html+=group('Размеры комнаты',field('length','Длина','м','',true)+field('width','Ширина','м','',true)+field('height','Высота','м','',true),true);
  html+=group('Проёмы и слои',field('openings','Окна и двери','м²','Общая площадь всех проёмов')+field('coats','Количество слоёв','сл.'));
  html+=group('Ваша краска',field('coverage','Укрывистость','м²/л','На один слой, с упаковки')+field('pack','Объём банки','л')+field('price','Цена за банку','₸')+field('reserve','Запас','%','От 0 до 50%'));
 }else if(type==='tile'){
  html+=group('Размеры поверхности',field('length','Длина','м','',true)+field('width','Ширина / высота','м','',true));
  html+=group('Ваша плитка',field('tileL','Длина плитки','см')+field('tileW','Ширина плитки','см')+field('pack','Плиток в упаковке','шт.')+field('price','Цена упаковки','₸'));
  html+=group('Уточнения',field('openings','Исключить площадь','м²','Участки без плитки')+field('reserve','Запас на подрезку','%','От 0 до 50%'));
 }else{
  html+=group('Размеры стены',field('length','Длина','м','',true)+field('height','Высота','м','',true));
  html+=group('Проёмы и толщина',field('openings','Окна и двери','м²')+`<div class="field"><label for="f-layers">Толщина кладки</label><select id="f-layers" name="layers"><option value="1" ${params.brick.layers===1?'selected':''}>В полкирпича</option><option value="2" ${params.brick.layers===2?'selected':''}>В один кирпич</option></select></div>`);
  html+=group('Ваш кирпич',field('brickL','Длина кирпича','мм')+field('brickH','Высота кирпича','мм')+field('joint','Шов','мм')+field('price','Цена за штуку','₸')+field('reserve','Запас','%','От 0 до 50%'));
 }
 html+='<div class="reserve-presets"><button type="button" data-reserve="5">Запас 5%</button><button type="button" data-reserve="10">10%</button><button type="button" data-reserve="15">15%</button></div>';
 $('#fields').innerHTML=html;$('#optimizer').hidden=type!=='paint';$('#cancel-edit').hidden=!editId;update();
}
// Изометрическая проекция на SVG. Геометрия реагирует на размеры.
function draw(){
 const p=params[type];const valid=n=>Number.isFinite(n)&&n>0;const L=valid(p.length)?p.length:5,W=valid(p.width)?p.width:3,H=valid(p.height)?p.height:2.8;
 const l=Math.min(12,L),w=Math.min(10,W),h=Math.min(6,H),sc=20;let lines='';
 const label=(x,y,t)=>`<text x="${x}" y="${y}" text-anchor="middle" transform="${turn%2?'translate('+(2*x)+' 0) scale(-1 1)':''}" fill="#b9cac7" font-size="11" font-family="Arial,sans-serif">${esc(t)}</text>`;
 let defs='<defs><pattern id="tile-grid" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="24" height="24" fill="'+color+'44" stroke="#e1e3d480" stroke-width=".7"/></pattern><pattern id="brick-grid" width="48" height="24" patternUnits="userSpaceOnUse"><path d="M0 0H48V24H0Z M0 12H48 M24 0V12 M12 12V24 M36 12V24" fill="'+color+'50" stroke="'+color+'" stroke-width=".8"/></pattern></defs>';
 if(view==='plan'){
  const rh=type==='brick'?H:W;const scale=Math.min(280/L,160/rh),dx=L*scale,dy=rh*scale,x=(440-dx)/2,y=(240-dy)/2;
  lines=`<rect x="${x}" y="${y}" width="${dx}" height="${dy}" fill="${type==='brick'?'url(#brick-grid)':type==='tile'?'url(#tile-grid)':'#b7c7a523'}" stroke="${color}" stroke-width="${type==='paint'?5:1.5}"/>`;
  lines+=label(220,y+dy+23,fmt(L)+' м')+label(Math.max(24,x-28),y+dy/2,fmt(rh)+' м');
  if(type==='paint')lines+=label(220,120,'h = '+fmt(H)+' м');
 }else if(type==='brick'){
  const scale=Math.min(280/L,150/H),dx=L*scale,dy=H*scale,x=(440-dx)/2,y=(230-dy)/2;
  lines=`<path d="M${x} ${y}l15 -11h${dx}v${dy}l-15 11" fill="${color}22" stroke="${color}"/><rect x="${x}" y="${y}" width="${dx}" height="${dy}" fill="url(#brick-grid)" stroke="${color}"/>`+label(220,y+dy+26,fmt(L)+' м')+label(x-25,y+dy/2,fmt(H)+' м');
 }else{
  let ax=l*sc*.75,ay=l*sc*.33,bx=-w*sc*.75,by=w*sc*.33,z=type==='tile'?0:h*sc;
  const allw=ax-bx,s=Math.min(1,330/allw,185/(ay+by+z));ax*=s;ay*=s;bx*=s;by*=s;z*=s;
  const ox=220-(ax+bx)/2,oy=125-(ay+by-z)/2;
  const points=[[ox,oy],[ox+ax,oy+ay],[ox+ax+bx,oy+ay+by],[ox+bx,oy+by]];
  const poly=(pts,fill,stroke='#8da4a0')=>`<polygon points="${pts.map(v=>v.join(',')).join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="1.2"/>`;
  lines+=poly(points,type==='tile'?'url(#tile-grid)':'#adbd9020');
  if(z){const [a,b,c,d]=points;lines+=poly([a,d,[d[0],d[1]-z],[a[0],a[1]-z]],color+'55');lines+=poly([a,b,[b[0],b[1]-z],[a[0],a[1]-z]],color+'bb',color);
   if(p.openings>0){const x1=a[0]+ax*.28,y1=a[1]+ay*.28,x2=a[0]+ax*.6,y2=a[1]+ay*.6;lines+=poly([[x1,y1-z*.3],[x2,y2-z*.3],[x2,y2-z*.7],[x1,y1-z*.7]],'#172d37',color);}
   lines+=label(d[0]-20,d[1]-z/2,fmt(H)+' м');
  }
  lines+=label((points[1][0]+points[2][0])/2+20,(points[1][1]+points[2][1])/2+20,fmt(W)+' м');
  lines+=label((points[2][0]+points[3][0])/2-8,(points[2][1]+points[3][1])/2+24,fmt(L)+' м');
 }
 $('#drawing').innerHTML=`<svg viewBox="0 0 440 245" role="img" aria-label="Схематичный ${view==='plan'?'план':'объём'}: ${meta[type].name}">${defs}<g transform="${turn%2?'translate(440 0) scale(-1 1)':''}">${lines}</g></svg>`;
 $('#scene-size').textContent=fmt(L)+' × '+fmt(type==='brick'?H:W)+' м';
}
function renderSwatches(){$('#swatches').innerHTML=colors.map((c,i)=>`<button data-color="${c}" style="background:${c}" class="${color===c?'active':''}" aria-label="Цвет схемы ${i+1}" aria-pressed="${color===c}"></button>`).join('');}
function update(){
 $$('#calc-form input[name],#calc-form select[name]').forEach(el=>{params[type][el.name]=el.value.trim()===''?NaN:Number(el.value);});
 try{
  result=BuildMath.calculate(type,params[type]);$('#form-error').hidden=true;
  $('#quantity-label').textContent=meta[type].need;$('#quantity').innerHTML=fmt(result.required,2)+' <small>'+result.unit+'</small>';
  $('#reserve-chip').textContent='+'+fmt(params[type].reserve)+'% запас';$('#area').textContent=fmt(result.area,2)+' м²';$('#purchase').textContent=fmt(result.count,0)+' '+result.purchaseUnit;
  $('#surplus').textContent=fmt(Math.max(0,result.purchased-result.required),2)+' '+result.unit;$('#cost').textContent=money(result.cost);
  $('#formula').textContent=result.formula;
  $('#formula-values').textContent=`Общая площадь ${fmt(result.gross,2)} м² − исключённая ${fmt(params[type].openings,2)} м² = ${fmt(result.area,2)} м². К покупке ${fmt(result.purchased,2)} ${result.unit} на ${money(result.cost)}.`;
  $('#add-estimate').disabled=false;
 }catch(e){result=null;$('#form-error').hidden=false;$('#form-error').textContent=e.message;['quantity','area','purchase','surplus','cost'].forEach(id=>$('#'+id).textContent='—');$('#formula').textContent='Исправьте параметры для расчёта.';$('#formula-values').textContent='';$('#add-estimate').disabled=true;}
 $('#add-estimate').innerHTML=(editId?'Обновить позицию':'Добавить в смету')+' <span>'+(editId?'✓':'＋')+'</span>';draw();if(type==='paint')renderPacks();
}
function renderPrices(){$('#pack-prices').innerHTML=[1,2.5,5,10].map((size,i)=>`<div><label for="pack-${i}">Банка ${fmt(size)} л</label><div class="input-wrap"><input id="pack-${i}" type="number" inputmode="decimal" min="0.01" step="any" data-price="${i}" value="${prices[i]}"><span>₸</span></div></div>`).join('');}
const combo=m=>m.sizes.map((size,i)=>m.parts[i]?`${m.parts[i]} × ${fmt(size)} л`:null).filter(Boolean).join(' + ');
function renderPacks(){
 if(!result){packs=null;$('#pack-results').innerHTML='<p class="hint">Заполните корректные параметры комнаты для подбора.</p>';return;}
 try{packs=BuildMath.optimizePaint(result.required,prices);$('#pack-results').innerHTML='<div class="pack-result-grid">'+['cheapest','leastSurplus'].map((key,i)=>{const m=packs[key],saving=result.cost-m.cost;return `<article class="pack-option"><h4>${i?'Меньше остатка':'Минимальная стоимость'}</h4><p class="combo">${combo(m)}</p><strong>${money(m.cost)}</strong><p>Всего ${fmt(m.volume)} л · остаток ${fmt(m.surplus,2)} л</p><p class="saving">${saving>0?'На '+money(saving)+' дешевле текущих банок':saving<0?'На '+money(-saving)+' дороже текущих банок':'Та же стоимость, что у текущих банок'}</p><button class="btn dark" data-pack="${key}">${editId?'Заменить позицию':'В смету с этим набором'} ↗</button></article>`;}).join('')+'</div>';}
 catch(e){packs=null;$('#pack-results').innerHTML='<p class="hint">'+esc(e.message)+'</p>';}
}
function resetEdit(){editId=null;$('#cancel-edit').hidden=true;$('#add-estimate').innerHTML='Добавить в смету <span>＋</span>';}
function addItem(mode=null){if(!result)return;try{const raw={id:editId||uid(),type,params:structuredClone(params[type]),mode,packPrices:mode?prices:null,label:editId?items.find(i=>i.id===editId)?.label:meta[type].name};const item=restore(raw);if(editId)items=items.map(i=>i.id===editId?item:i);else if(items.length<100)items.push(item);else{toast('В одной смете доступно до 100 позиций.');return;}resetEdit();persist();renderEstimate();renderPacks();toast('Позиция сохранена в смете');}catch(e){toast(e.message);}}
function renderEstimate(){
 $('#item-count').textContent=items.length;$('#estimate-footer').hidden=!items.length;
 $('#estimate-list').innerHTML=items.length?items.map(i=>`<div class="estimate-row"><span class="row-icon">${meta[i.type].icon}</span><div class="row-title">${esc(i.label)}<small>${fmt(i.result.area,2)} м² · запас ${fmt(i.params.reserve)}%${i.mix?' · набор банок':''}</small></div><span class="row-qty">${i.mix?combo(i.mix):fmt(i.result.count,0)+' '+i.result.purchaseUnit}</span><span class="row-cost">${money(i.result.cost)}</span><div class="row-tools"><button data-edit="${esc(i.id)}" aria-label="Изменить ${esc(i.label)}" title="Изменить">✎</button><button data-remove="${esc(i.id)}" aria-label="Удалить ${esc(i.label)}" title="Удалить">×</button></div></div>`).join(''):'<div class="empty"><span>▧</span><strong>У вашего ремонта уже есть план?</strong><p>Начните с расчёта выше. Добавьте материалы, и здесь появится смета.</p></div>';
 const total=items.reduce((s,i)=>s+i.result.cost,0),budget=currentBudget();$('#total').textContent=money(total);
 $('#budget-status').textContent=budget?(total>budget?'Выше бюджета на '+money(total-budget):'Остаётся в бюджете '+money(budget-total)):'Добавьте бюджет, чтобы контролировать расходы';$('#budget-status').classList.toggle('over',budget>0&&total>budget);$('#budget-fill').style.width=budget?Math.min(100,total/budget*100)+'%':'0';$('#budget-fill').style.background=budget&&total>budget?'#ef734b':'#91a67b';
 $('#save-project').textContent=activeProjectId&&projects.some(p=>p.id===activeProjectId)?'Обновить проект ↗':'Сохранить проект ↗';
}
function renderProjects(){
 $('#project-count').textContent=projects.length;
 $('#projects-list').innerHTML=projects.length?projects.map(p=>`<article class="project-card"><span>${Number.isNaN(Date.parse(p.date))?'СОХРАНЁННЫЙ ПРОЕКТ':new Date(p.date).toLocaleDateString('ru-RU')}</span><h3>${esc(p.name)}</h3><p>${p.items.length} позиций · ${[...new Set(p.items.map(i=>meta[i.type].name))].join(', ')}</p><strong>${money(p.items.reduce((s,i)=>s+i.result.cost,0))}</strong><div><button class="btn dark" data-open="${esc(p.id)}">Открыть ↗</button><button class="btn outline" data-delete="${esc(p.id)}" aria-label="Удалить проект ${esc(p.name)}">×</button></div></article>`).join(''):'<div class="empty"><span>▧</span><strong>Место для вашего первого проекта</strong><p>Сохраните смету в калькуляторе или импортируйте файл проекта.</p><button class="btn dark" data-page="calculator">К калькулятору ↗</button></div>';
}
function navigate(page){if(!['calculator','projects','guide'].includes(page))page='calculator';$$('.page').forEach(s=>s.hidden=s.id!=='page-'+page);$$('nav button').forEach(b=>{const on=b.dataset.page===page;b.classList.toggle('active',on);if(on)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});history.replaceState(null,'','#'+page);if(page==='projects')renderProjects();window.scrollTo({top:0,behavior:'instant'});}
function download(data,type,name){const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function currentProject(){return{name:$('#project-name').value.trim()||'Новый проект',budget:currentBudget(),items:structuredClone(items)};}
function projectHasChanges(){const p=projects.find(p=>p.id===activeProjectId);return items.length>0&&(!p||JSON.stringify(p.items)!==JSON.stringify(items)||p.name!==$('#project-name').value.trim()||p.budget!==currentBudget());}
async function openProject(id){const p=projects.find(p=>p.id===id);if(!p)return;if(projectHasChanges()&&!await question('Открыть другую смету?','Текущие несохранённые изменения будут заменены.'))return;items=structuredClone(p.items);activeProjectId=p.id;$('#project-name').value=p.name;$('#budget').value=p.budget||'';resetEdit();persist();renderEstimate();navigate('calculator');$('#estimate').scrollIntoView({behavior:'smooth'});}

document.addEventListener('click',async e=>{
 const el=e.target.closest('button');if(!el)return;
 if(el.dataset.page)navigate(el.dataset.page);
 if(el.dataset.material){type=el.dataset.material;resetEdit();renderForm();}
 if(el.dataset.preset!==undefined){const p=presets[type][Number(el.dataset.preset)];params[type]={...params[type],length:p[1],openings:p[4],...(type==='brick'?{height:p[3]}:type==='paint'?{width:p[2],height:p[3]}:{width:p[2]})};renderForm();}
 if(el.dataset.reserve){$('#f-reserve').value=el.dataset.reserve;update();}
 if(el.dataset.view){view=el.dataset.view;$$('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);b.setAttribute('aria-pressed',b.dataset.view===view);});draw();}
 if(el.dataset.color){color=el.dataset.color;renderSwatches();draw();}
 if(el.dataset.pack)addItem(el.dataset.pack);
 if(el.dataset.remove){const old=items.find(i=>i.id===el.dataset.remove);items=items.filter(i=>i.id!==el.dataset.remove);if(editId===old?.id)resetEdit();persist();renderEstimate();toast('Позиция удалена');}
 if(el.dataset.edit){const i=items.find(i=>i.id===el.dataset.edit);if(!i)return;editId=i.id;type=i.type;params[type]=structuredClone(i.params);if(i.packPrices){prices=[...i.packPrices];renderPrices();}renderForm();$('#workspace').scrollIntoView({behavior:'smooth'});toast('Измените параметры и сохраните позицию');}
 if(el.dataset.open)await openProject(el.dataset.open);
 if(el.dataset.delete&&await question('Удалить проект?','Сохранённая смета исчезнет из этого браузера.')){const next=projects.filter(p=>p.id!==el.dataset.delete);if(write('buildcalc-projects-v1',next)){projects=next;if(activeProjectId===el.dataset.delete)activeProjectId=null;renderProjects();renderEstimate();persist();toast('Проект удалён');}}
});
$('#calc-form').addEventListener('input',e=>{if(e.target.dataset.slider){$('#f-'+e.target.dataset.slider).value=e.target.value;}else if(e.target.name){const slider=$('[data-slider="'+e.target.name+'"]');if(slider&&e.target.value!=='')slider.value=e.target.value;}update();});
$('#calc-form').addEventListener('change',update);$('#calc-form').onsubmit=e=>e.preventDefault();
$('#pack-prices').addEventListener('input',e=>{if(e.target.dataset.price!==undefined){prices[Number(e.target.dataset.price)]=e.target.value.trim()===''?NaN:Number(e.target.value);renderPacks();}});
$('#rotate').onclick=()=>{turn++;draw();};$('#start').onclick=()=>$('#workspace').scrollIntoView({behavior:'smooth'});
$('#reset').onclick=()=>{params[type]={...defaults[type]};renderForm();toast('Параметры примера восстановлены');};
$('#add-estimate').onclick=()=>addItem();$('#cancel-edit').onclick=()=>{resetEdit();renderForm();};
$('#project-name').oninput=persist;$('#budget').oninput=()=>{renderEstimate();persist();};
$('#new-estimate').onclick=async()=>{if(projectHasChanges()&&!await question('Начать новую смету?','Несохранённые изменения текущей сметы будут удалены.'))return;items=[];activeProjectId=null;$('#project-name').value='';$('#budget').value='';resetEdit();renderEstimate();persist();toast('Новая смета готова');};
$('#save-project').onclick=()=>{if(!items.length)return;const name=$('#project-name').value.trim();if(!name){toast('Укажите название проекта');$('#project-name').focus();return;}const p={...currentProject(),id:activeProjectId||uid(),date:new Date().toISOString()},next=[p,...projects.filter(i=>i.id!==p.id)];if(write('buildcalc-projects-v1',next)){projects=next;activeProjectId=p.id;persist();renderProjects();renderEstimate();toast('Проект сохранён');}};
$('#export-json').onclick=()=>{if(items.length)download(JSON.stringify({format:'BuildCalc',version:2,project:currentProject()},null,2),'application/json','BuildCalc-project.json');};
$('#export-csv').onclick=()=>{if(!items.length)return;const rows=[['BuildCalc Studio'],[$('#project-name').value.trim()||'Новая смета'],['Материал','Площадь м²','Запас %','Покупка','Стоимость KZT'],...items.map(i=>[i.label,i.result.area.toFixed(2),i.params.reserve,i.mix?combo(i.mix):i.result.count+' '+i.result.purchaseUnit,i.result.cost.toFixed(2)]),['ИТОГО','','','',items.reduce((s,i)=>s+i.result.cost,0).toFixed(2)]];const data='\uFEFF'+rows.map(r=>r.map(v=>{let s=String(v);if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}).join(';')).join('\r\n');download(data,'text/csv;charset=utf-8','BuildCalc-estimate.csv');};
$('#print').onclick=()=>{if(!items.length)return;$('#print-heading').textContent=($('#project-name').value.trim()||'Смета ремонта')+' · '+new Date().toLocaleDateString('ru-RU')+'. Цены пользователя. Работа, доставка, клей и раствор не включены. Предварительная оценка материалов.';const old=document.title;document.title=$('#project-name').value.trim()||'BuildCalc';window.print();document.title=old;};
$('#import-btn').onclick=()=>$('#import-file').click();$('#import-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>1e6)throw new Error('Файл слишком большой. Максимум 1 МБ.');const data=JSON.parse(await file.text());if(data.format!=='BuildCalc'||data.version!==2||!data.project||!Array.isArray(data.project.items)||!data.project.items.length||data.project.items.length>100)throw new Error('Нужен файл проекта BuildCalc Studio.');const p=data.project;if(typeof p.name!=='string'||!p.name.trim()||!Number.isFinite(p.budget)||p.budget<0||p.budget>1e12)throw new Error('Некорректные данные проекта.');const project={name:p.name.slice(0,70),budget:p.budget,items:p.items.map(i=>({...restore(i),id:uid()})),id:uid(),date:new Date().toISOString()},next=[project,...projects];if(write('buildcalc-projects-v1',next)){projects=next;renderProjects();toast('Проект импортирован. Можно открыть его в списке.');}}catch(err){toast(err instanceof SyntaxError?'Не удалось прочитать JSON-файл.':err.message);}finally{e.target.value='';}};
window.addEventListener('hashchange',()=>navigate(location.hash.slice(1)));
renderPrices();renderSwatches();renderForm();renderEstimate();renderProjects();navigate(location.hash.slice(1));
