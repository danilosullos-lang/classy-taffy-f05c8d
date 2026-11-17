/* PvP loot selection and equipment cleanup.
 * Pure client-side rules for the existing peer-to-peer PvP flow.
 * A trusted server is still required for authoritative item ownership.
 */
(function(root){
  'use strict';
  const MAX_DROP_ITEMS=3;
  function preparePvpDrop(inventory,equipment,options={}){
    options=options&&typeof options==='object'?options:{};
    const fail=reason=>({ok:false,reason,items:[],inventory:null,equipment:null,removedEquipmentSlots:[]});
    if(!Array.isArray(inventory)||!equipment||typeof equipment!=='object'||Array.isArray(equipment))
      return fail('invalid_state');

    const seen=new Set();
    for(const item of inventory){
      if(!item||typeof item!=='object'||item.u===undefined||item.u===null)continue;
      const key=String(item.u);
      if(seen.has(key))return fail('duplicate_item_id');
      seen.add(key);
    }

    const random=typeof options.random==='function'?options.random:Math.random;
    const roll=()=>{
      let value;
      try{value=Number(random())}catch{return null}
      return Number.isFinite(value)&&value>=0&&value<1?value:null;
    };
    const red=options.red===true;
    const equipped=new Set(Object.values(equipment));
    const unlocked=inventory.filter(item=>item&&typeof item==='object'&&!item.lock&&item.u!==undefined&&item.u!==null);
    const unequipped=unlocked.filter(item=>!equipped.has(item.u));
    const candidates=unequipped.length?unequipped:unlocked;
    const items=[];

    if(candidates.length){
      const value=roll();
      if(value===null)return fail('invalid_random');
      items.push(candidates[Math.floor(value*candidates.length)]);
    }

    if(red){
      for(const item of inventory){
        if(items.length>=MAX_DROP_ITEMS)break;
        const rarity=Number(item&&item.r);
        if(!item||typeof item!=='object'||item.lock||!Number.isFinite(rarity)||rarity<2||item.u===undefined||item.u===null||items.includes(item))continue;
        const value=roll();
        if(value===null)return fail('invalid_random');
        if(value<.35)items.push(item);
      }
    }

    const droppedIds=new Set(items.map(item=>item.u));
    const nextInventory=inventory.filter(item=>!items.includes(item));
    const nextEquipment={...equipment};
    const removedEquipmentSlots=[];
    for(const slot of Object.keys(nextEquipment)){
      if(droppedIds.has(nextEquipment[slot])){
        delete nextEquipment[slot];
        removedEquipmentSlots.push(slot);
      }
    }

    return {ok:true,items,inventory:nextInventory,equipment:nextEquipment,removedEquipmentSlots,reason:null};
  }

  const api=Object.freeze({MAX_DROP_ITEMS,preparePvpDrop});
  root.AetheriaPvpLoot=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
