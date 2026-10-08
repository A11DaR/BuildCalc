// Проверка логики приложения с минимальным DOM, без визуального браузера.
const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const nodes=[],map=new Map(),events={},storage=new Map();let zone='html';
class El{
 constructor(tag,attrs){this.tag=tag;this.attrs=attrs;this.id=attrs.id||'';this.dataset={};for(const [k,v]of Object.entries(attrs))if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=v;this.name=attrs.name||'';this.value=attrs.value||'';this.textContent='';this.hidden=false;this.disabled=false;this.style={};this.events={};this.zone=zone;this.classes=new Set((attrs.class||'').split(' '));this.classList={add:x=>this.classes.add(x),remove:x=>this.classes.delete(x),toggle:(x,b)=>b?this.classes.add(x):this.classes.delete(x)};nodes.push(this);if(this.id)map.set(this.id,this);}
 set innerHTML(s){this._html=s;if(['fields','pack-prices','projects-list','estimate-list'].includes(this.id)){for(let i=nodes.length-1;i>=0;i--)if(nodes[i].zone===this.id){map.delete(nodes[i].id);nodes.splice(i,1);}const old=zone;zone=this.id;parse(s);zone=old;}}
 get innerHTML(){return this._html||'';}setAttribute(k,v){this.attrs[k]=v;}removeAttribute(k){delete this.attrs[k];}addEventListener(k,f){this.events[k]=f;}removeEventListener(){}focus(){}scrollIntoView(){}closest(){return this;}click(){}showModal(){this.open=true;}close(v){this.returnValue=v;this.open=false;this.events.close?.();}
}
function parse(s){for(const m of s.matchAll(/<([a-z][\w-]*)([^>]*)>/g)){const attrs={};for(const a of m[2].matchAll(/([\w-]+)(?:="([^"]*)")?/g))attrs[a[1]]=a[2]||'';new El(m[1],attrs);}for(const m of s.matchAll(/<select[^>]*id="([^"]*)"[^>]*>([\s\S]*?)<\/select>/g)){const opts=[...m[2].matchAll(/<option value="([^"]*)"([^>]*)>/g)];const opt=opts.find(o=>o[2].includes('selected'))||opts[0];if(opt)map.get(m[1]).value=opt[1];}}
parse(fs.readFileSync('dist/index.html','utf8'));
function query(s){if(s==='#calc-form input[name],#calc-form select[name]')return nodes.filter(n=>n.zone==='fields'&&n.name);if(s==='nav button')return nodes.filter(n=>n.dataset.page&&n.zone==='html'&&n.tag==='button');if(s.startsWith('.'))return nodes.filter(n=>n.classes.has(s.slice(1)));if(/^#[\w-]+$/.test(s))return map.has(s.slice(1))?[map.get(s.slice(1))]:[];const m=s.match(/^\[data-([\w-]+)(?:="([^"]*)")?\]$/);if(m)return nodes.filter(n=>n.attrs['data-'+m[1]]!==undefined&&(m[2]===undefined||n.attrs['data-'+m[1]]===m[2]));return [];}
const ctx=vm.createContext({console,Intl,structuredClone,Date,Math,Number,JSON,Array,String,Error,SyntaxError,Promise,Blob,URL,setTimeout:()=>1,clearTimeout(){},crypto:{randomUUID:()=>Math.random().toString(36)},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},document:{querySelector:s=>query(s)[0]||null,querySelectorAll:query,addEventListener:(k,f)=>events[k]=f,createElement:tag=>new El(tag,{}),title:'BuildCalc'},location:{hash:''},history:{replaceState(){}},window:{addEventListener(){},scrollTo(){},print(){}},BuildMath:require('../dist/calc.js')});
vm.runInContext(fs.readFileSync('dist/app.js','utf8'),ctx);
const run=s=>vm.runInContext(s,ctx);
const click=selector=>events.click({target:query(selector)[0]});
(async()=>{
 assert.equal(map.get('cost').textContent.replace(/\s/g,''),'37500₸');
 map.get('add-estimate').onclick();assert.equal(run('items.length'),1);
 await click('[data-edit]');map.get('f-length').value='6';run('update()');map.get('add-estimate').onclick();assert.equal(run('items.length'),1);assert.equal(run('items[0].params.length'),6);
 await click('[data-material="paint"]');map.get('reset').onclick();run("addItem('cheapest')");assert.equal(run('items.length'),2);assert.equal(run('items[1].result.cost'),26700);
 map.get('project-name').value='Проверка <test>';map.get('budget').value='60000';map.get('save-project').onclick();assert.equal(JSON.parse(storage.get('buildcalc-projects-v1')).length,1);assert.equal(run('projects[0].budget'),60000);
 await click('[data-page="projects"]');assert(map.get('projects-list').innerHTML.includes('&lt;test&gt;'));
 const exported=run("JSON.stringify({format:'BuildCalc',version:2,project:currentProject()})");
 await map.get('import-file').onchange({target:{files:[{size:exported.length,text:async()=>exported}],value:'x'}});assert.equal(run('projects.length'),2);
 const malformed=JSON.stringify({format:'BuildCalc',version:2,project:{name:'Bad',budget:0,items:[{type:'paint',params:{}}]}});
 await map.get('import-file').onchange({target:{files:[{size:malformed.length,text:async()=>malformed}],value:'x'}});assert.equal(run('projects.length'),2);
 await click('[data-material="tile"]');assert.equal(run('type'),'tile');map.get('f-length').value='';run('update()');assert.equal(map.get('add-estimate').disabled,true);map.get('reset').onclick();assert.equal(map.get('add-estimate').disabled,false);
 map.get('add-estimate').onclick();assert.equal(run('items[2].result.count'),16);
 await click('[data-material="brick"]');assert.equal(run('result.count'),797);
 run('turn=1;draw()');assert(map.get('drawing').innerHTML.includes('scale(-1 1)'));
 assert.throws(()=>run("restore({type:'paint',params:{...defaults.paint},mode:'bad'})"));
 console.log('PASS: initial result, add/edit without duplication, mixed packs, save, escaped titles, valid/invalid import, material switching and validation, rotated drawing output.');
})().catch(e=>{console.error(e);process.exitCode=1;});
