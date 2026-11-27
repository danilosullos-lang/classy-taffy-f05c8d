/*!
 * Aetheria RPG — bounded grid navigation for land units.
 * Original Aetheria code; collision geometry is supplied by the game.
 */
(function(root,factory){
  const api=factory();
  if(root)root.AetheriaNavGrid=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const SQRT2=Math.SQRT2;
  const validPoint=p=>p&&Number.isFinite(Number(p.x))&&Number.isFinite(Number(p.z));
  const key=(x,z)=>x+','+z;
  function hasClearLine(start,goal,isBlocked,step=.9){
    if(!validPoint(start)||!validPoint(goal)||typeof isBlocked!=='function')return false;
    const dx=goal.x-start.x,dz=goal.z-start.z,distance=Math.hypot(dx,dz);
    if(distance<.001)return true;
    const stride=Math.max(.25,Math.min(3,Number(step)||.9));
    const samples=Math.ceil(distance/stride);
    for(let i=1;i<samples;i++){
      const t=i/samples;
      if(isBlocked(start.x+dx*t,start.z+dz*t))return false;
    }
    return true;
  }
  function heapPush(heap,node){
    let i=heap.length;heap.push(node);
    while(i>0){const p=(i-1)>>1;if(heap[p].f<=node.f)break;heap[i]=heap[p];i=p;heap[i]=node;}
  }
  function heapPop(heap){
    if(!heap.length)return null;
    const first=heap[0],last=heap.pop();
    if(heap.length){
      let i=0;heap[0]=last;
      for(;;){
        const l=i*2+1,r=l+1;
        if(l>=heap.length)break;
        let c=l;if(r<heap.length&&heap[r].f<heap[l].f)c=r;
        if(heap[i].f<=heap[c].f)break;
        const tmp=heap[i];heap[i]=heap[c];heap[c]=tmp;i=c;
      }
    }
    return first;
  }
  function smoothPath(start,path,isBlocked,step){
    if(path.length<3)return path;
    const out=[];let anchor=start,index=0;
    while(index<path.length){
      let far=index;
      for(let j=index+1;j<path.length;j++){
        if(hasClearLine(anchor,path[j],isBlocked,step))far=j;
        else break;
      }
      out.push(path[far]);anchor=path[far];index=far+1;
    }
    return out;
  }
  function findPath(start,goal,isBlocked,options={}){
    if(!validPoint(start)||!validPoint(goal)||typeof isBlocked!=='function')return [];
    const cellSize=Math.max(.75,Math.min(4,Number(options.cellSize)||2));
    const maxNodes=Math.max(32,Math.min(4000,Math.floor(Number(options.maxNodes)||600)));
    const maxDistance=Math.max(cellSize*2,Math.min(160,Number(options.maxDistance)||70));
    if(Math.hypot(goal.x-start.x,goal.z-start.z)>maxDistance)return [];
    const world=(x,z)=>({x:start.x+x*cellSize,z:start.z+z*cellSize});
    const blockedCache=new Map();
    const blockedAt=(x,z)=>{
      const k=key(x,z);
      if(blockedCache.has(k))return blockedCache.get(k);
      const p=world(x,z);let blocked=true;
      try{blocked=!!isBlocked(p.x,p.z)}catch(_){blocked=true}
      blockedCache.set(k,blocked);return blocked;
    };
    const startX=0,startZ=0;
    let goalX=Math.round((goal.x-start.x)/cellSize),goalZ=Math.round((goal.z-start.z)/cellSize);
    if(goalX===0&&goalZ===0)return [];
    if(blockedAt(goalX,goalZ)){
      let nearest=null,score=Infinity;
      for(let radius=1;radius<=4;radius++){
        for(let x=-radius;x<=radius;x++)for(let z=-radius;z<=radius;z++){
          if(Math.max(Math.abs(x-goalX),Math.abs(z-goalZ))!==radius)continue;
          if(blockedAt(x,z))continue;
          const candidate=(x-goalX)**2+(z-goalZ)**2;
          if(candidate<score){score=candidate;nearest={x,z}}
        }
        if(nearest)break;
      }
      if(!nearest)return [];
      goalX=nearest.x;goalZ=nearest.z;
    }
    const startKey=key(startX,startZ),goalKey=key(goalX,goalZ);
    const heuristic=(x,z)=>{
      const dx=Math.abs(goalX-x),dz=Math.abs(goalZ-z),min=Math.min(dx,dz);
      return Math.max(dx,dz)+(SQRT2-1)*min;
    };
    const open=[],bestG=new Map([[startKey,0]]),cameFrom=new Map(),closed=new Set();
    heapPush(open,{x:startX,z:startZ,g:0,f:heuristic(startX,startZ)});
    const dirs=[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
    let visited=0,found=false;
    while(open.length&&visited<maxNodes){
      const current=heapPop(open),currentKey=key(current.x,current.z);
      if(closed.has(currentKey)||current.g!==bestG.get(currentKey))continue;
      closed.add(currentKey);visited++;
      if(currentKey===goalKey){found=true;break}
      for(const [dx,dz] of dirs){
        const nx=current.x+dx,nz=current.z+dz,nk=key(nx,nz);
        if(closed.has(nk)||blockedAt(nx,nz))continue;
        if(dx&&dz&&(blockedAt(current.x+dx,current.z)||blockedAt(current.x,current.z+dz)))continue;
        const p=world(nx,nz);
        if(Math.hypot(p.x-start.x,p.z-start.z)>maxDistance)continue;
        const ng=current.g+(dx&&dz?SQRT2:1);
        if(ng>=(bestG.get(nk)??Infinity))continue;
        bestG.set(nk,ng);cameFrom.set(nk,currentKey);
        heapPush(open,{x:nx,z:nz,g:ng,f:ng+heuristic(nx,nz)});
      }
    }
    if(!found)return [];
    const path=[];let cursor=goalKey;
    while(cursor!==startKey){
      const [x,z]=cursor.split(',').map(Number);
      path.push(world(x,z));cursor=cameFrom.get(cursor);
      if(!cursor)return [];
    }
    path.reverse();
    return smoothPath(start,path,isBlocked,Math.max(.35,cellSize*.45));
  }
  return Object.freeze({hasClearLine,findPath});
});
