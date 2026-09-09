/* Pure draw rules, shared by the kiosk and regression checks. */
(function(root){
  function candidates(ips, stock, kind){
    const out=[];
    ips.forEach(ip=>ip.prizes.forEach((p,i)=>{
      if(p.hidden || (p.kind || (p.tier==='high'?'figure':'participation'))!==kind) return;
      const cell=(stock[ip.id]||[])[i];
      const add=(count,sub)=>{ if(Number.isInteger(count)&&count>0) out.push({ip,p,index:i,sub,count}); };
      if(Array.isArray(cell)) cell.forEach((n,j)=>{if(p.subs&&p.subs[j])add(n,j);});
      else add(cell,null);
    }));
    return out;
  }
  function availability(ips,stock,percent=null){
    const figures=candidates(ips,stock,'figure'), participation=candidates(ips,stock,'participation');
    if(percent===null) return figures.length||participation.length ? {ok:true,figures,participation} : {ok:false,reason:'추첨 가능한 경품이 모두 소진되었습니다.'};
    if(!Number.isFinite(percent)||percent<0||percent>100) return {ok:false,reason:'피규어 당첨 확률을 0~100%로 설정해주세요.'};
    if(percent<100&&!participation.length) return {ok:false,reason:'참가상 재고를 준비해주세요.'};
    if(percent===100&&!figures.length) return {ok:false,reason:'피규어 경품이 모두 소진되었습니다.'};
    return {ok:true,figures,participation};
  }
  function draw(ips,stock,percent=null,random=Math.random){
    const state=availability(ips,stock,percent);
    if(!state.ok) throw Error(state.reason);
    const selectedKind=percent===null?null:state.figures.length&&random()<percent/100?'figure':'participation';
    const pool=selectedKind===null?[...state.figures,...state.participation]:selectedKind==='figure'?state.figures:state.participation;
    let ticket=random()*pool.reduce((n,c)=>n+c.count,0);
    let hit=pool[pool.length-1];
    for(const candidate of pool){ticket-=candidate.count;if(ticket<0){hit=candidate;break;}}
    const next=JSON.parse(JSON.stringify(stock));
    if(hit.sub==null)next[hit.ip.id][hit.index]--;else next[hit.ip.id][hit.index][hit.sub]--;
    const kind=hit.p.kind||(hit.p.tier==='high'?'figure':'participation');
    return {...hit,kind,stock:next};
  }
  root.FigureDrawEngine={candidates,availability,draw};
})(typeof module==='object'?module.exports:globalThis);
