/* Authenticated API client for Aetheria account and character persistence. */
(function(root){
  'use strict';
  const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  class AccountClient {
    constructor({base='/api',storage}={}){this.base=base.replace(/\/$/,'');this.storage=storage||(typeof sessionStorage!=='undefined'?sessionStorage:null);this.tokenKey='aetheria.session.v1';this.userKey='aetheria.account.user.v1';}
    get token(){try{return this.storage?.getItem(this.tokenKey)||'';}catch{return '';}}
    set token(value){try{if(value)this.storage?.setItem(this.tokenKey,value);else this.storage?.removeItem(this.tokenKey);}catch{}}
    get accountId(){try{const value=this.storage?.getItem(this.userKey)||'';return UUID.test(value)?value:'';}catch{return '';}}
    set accountId(value){try{if(value&&UUID.test(String(value)))this.storage?.setItem(this.userKey,String(value));else this.storage?.removeItem(this.userKey);}catch{}}
    async request(path,{method='GET',body,auth=true}={}){
      const headers={'Accept':'application/json'};if(body!==undefined)headers['Content-Type']='application/json';if(auth&&this.token)headers.Authorization='Bearer '+this.token;
      const response=await fetch(this.base+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),credentials:'same-origin'});
      let payload={};try{payload=await response.json();}catch{}
      if(!response.ok){const error=new Error(payload.error||'request_failed');error.status=response.status;throw error;}
      return payload;
    }
    _acceptSession(result){this.token=result&&result.token||'';this.accountId=result&&result.user&&result.user.id||'';return result&&result.user||null;}
    async register(email,password){return this._acceptSession(await this.request('/auth/register',{method:'POST',auth:false,body:{email,password}}));}
    async login(email,password){return this._acceptSession(await this.request('/auth/login',{method:'POST',auth:false,body:{email,password}}));}
    async listCharacters(){return (await this.request('/characters')).characters||[];}
    async saveCharacter(character){if(!character||!Number.isSafeInteger(character.expectedRevision)||character.expectedRevision<0){const error=new Error('expected_revision_required');error.status=400;throw error;}return (await this.request('/characters',{method:'PUT',body:character})).character;}
    logout(){this.token='';this.accountId='';}
    get authenticated(){return !!this.token;}
  }
  root.AetheriaAccount=Object.freeze({AccountClient,create:options=>new AccountClient(options)});
  if(typeof module!=='undefined'&&module.exports)module.exports=root.AetheriaAccount;
})(typeof window!=='undefined'?window:globalThis);
