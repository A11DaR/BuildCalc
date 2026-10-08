/* Чистые расчёты: этот файл не зависит от интерфейса. */
(function (root) {
  function calculate(type, p) {
    for (const [key, value] of Object.entries(p)) {
      if (!Number.isFinite(value) || value < 0) throw new Error('Заполните все поля корректными неотрицательными числами.');
      if (value > 1000000000) throw new Error('Слишком большое значение. Проверьте единицы измерения.');
    }
    const positive = type === 'paint' ? ['length','width','height','coverage','coats','pack'] : type === 'tile' ? ['length','width','tileL','tileW','pack'] : ['length','height','brickL','brickH','layers'];
    if (positive.some(k => !(p[k] > 0))) throw new Error('Размеры, расход и размер упаковки должны быть больше нуля.');
    if (p.reserve > 50) throw new Error('Укажите запас от 0 до 50%.');
    if (type === 'tile' && !Number.isInteger(p.pack)) throw new Error('Количество плиток в упаковке должно быть целым.');
    if (type === 'paint' && !Number.isInteger(p.coats)) throw new Error('Количество слоёв должно быть целым.');
    let gross = type === 'paint' ? 2 * (p.length + p.width) * p.height : p.length * (type === 'tile' ? p.width : p.height);
    let area = gross - p.openings;
    if (area <= 0) throw new Error('Площадь проёмов должна быть меньше площади поверхности.');
    let base, required, count, purchased, unit, purchaseUnit, formula;
    if (type === 'paint') {
      base = area * p.coats / p.coverage; required = base * (1 + p.reserve / 100);
      count = Math.ceil(Number((required / p.pack).toFixed(10))); purchased = count * p.pack;
      unit = 'л'; purchaseUnit = 'бан.'; formula = 'Площадь стен × слои ÷ укрывистость × (1 + запас / 100). Округляем до целых банок.';
    } else if (type === 'tile') {
      base = area / ((p.tileL / 100) * (p.tileW / 100)); required = Math.ceil(Number((base * (1 + p.reserve / 100)).toFixed(10)));
      count = Math.ceil(required / p.pack); purchased = count * p.pack;
      unit = 'шт.'; purchaseUnit = 'уп.'; formula = 'Площадь поверхности ÷ площадь плитки × (1 + запас / 100). Округляем до целых плиток и упаковок. Швы не вычитаются.';
    } else {
      base = area / (((p.brickL + p.joint) / 1000) * ((p.brickH + p.joint) / 1000)) * p.layers;
      required = Math.ceil(Number((base * (1 + p.reserve / 100)).toFixed(10))); count = required; purchased = count;
      unit = 'шт.'; purchaseUnit = 'шт.'; formula = 'Площадь стены ÷ площадь лицевой грани со швом × число рядов по толщине × (1 + запас / 100). Приближённая оценка кладки.';
    }
    if (![area,required,count,purchased,count*p.price].every(v => Number.isFinite(v) && v <= Number.MAX_SAFE_INTEGER)) throw new Error('Результат слишком большой. Проверьте размеры и единицы измерения.');
    return {area,gross,base,required,count,purchased,unit,purchaseUnit,cost:count*p.price,extra:purchased-base,formula};
  }
  // Половина литра — точная единица для банок 1 / 2.5 / 5 / 10 л.
  // Динамическое программирование перебирает объёмы, а не случайные наборы.
  function optimizePaint(required, prices) {
    const sizes=[1,2.5,5,10];
    if (!Number.isFinite(required) || required<=0 || required>10000) throw new Error('Подбор доступен для объёма до 10 000 л.');
    if (!Array.isArray(prices) || prices.length!==4 || prices.some(p=>!Number.isFinite(p)||p<=0||p>1e9)) throw new Error('Укажите положительные цены всех четырёх банок.');
    const target=Math.ceil(required*2-1e-9),limit=target+19;
    const costs=Array(limit+1).fill(Infinity),prev=Array(limit+1).fill(-1),counts=Array(limit+1).fill(Infinity);
    costs[0]=0;counts[0]=0;
    for(let v=1;v<=limit;v++)for(let k=0;k<4;k++) {
      const from=v-sizes[k]*2;if(from<0)continue;
      const cost=costs[from]+Math.round(prices[k]*100),cnt=counts[from]+1;
      if(cost<costs[v]||(cost===costs[v]&&cnt<counts[v])){costs[v]=cost;counts[v]=cnt;prev[v]=k;}
    }
    const valid=Array.from({length:20},(_,i)=>target+i).filter(v=>Number.isFinite(costs[v]));
    const cheap=[...valid].sort((a,b)=>costs[a]-costs[b]||a-b)[0];
    function pack(v){const parts=[0,0,0,0];let at=v;while(at>0){const k=prev[at];parts[k]++;at-=sizes[k]*2;}return{sizes,prices:[...prices],parts,volume:v/2,cost:costs[v]/100,count:parts.reduce((a,b)=>a+b,0),surplus:v/2-required};}
    return {cheapest:pack(cheap),leastSurplus:pack(valid[0])};
  }
  if (typeof module !== 'undefined') module.exports = {calculate,optimizePaint};
  else root.BuildMath = {calculate,optimizePaint};
})(typeof window !== 'undefined' ? window : globalThis);
