/* Authenticated API client for Aetheria account and character persistence. */
(function(root){
  'use strict';
  class AccountClient {
    constructor({base='/api',storage}={}){this.base=base.replace(/\/$/,'');this.storage=storage||(typeof sessionStorage!=='undefined'?sessionStorage:null);this.tokenKey='aetheria.session.v1';}
    get token(){try{return this.storage?.getItem(this.tokenKey)||'';}catch{return '';}}
    set token(value){try{if(value)this.storage?.setItem(this.tokenKey,value);else this.storage?.removeItem(this.tokenKey);}catch{}}
    async request(path,{method='GET',body,auth=true}={}){
      const headers={'Accept':'application/json'};if(body!==undefined)headers['Content-Type']='application/json';if(auth&&this.token)headers.Authorization='Bearer '+this.token;
      const response=await fetch(this.base+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),credentials:'same-origin'});
      let payload={};try{payload=await response.json();}catch{}
      if(!response.ok){const error=new Error(payload.error||'request_failed');error.status=response.status;throw error;}
      return payload;
    }
    async register(email,password){const result=await this.request('/auth/register',{method:'POST',auth:false,body:{email,password}});this.token=result.token;return result.user;}
    async login(email,password){const result=await this.request('/auth/login',{method:'POST',auth:false,body:{email,password}});this.token=result.token;return result.user;}
    async listCharacters(){return (await this.request('/characters')).characters||[];}
    async saveCharacter(character){return (await this.request('/characters',{method:'PUT',body:character})).character;}
    logout(){this.token='';}
    get authenticated(){return !!this.token;}
  }
  root.AetheriaAccount=Object.freeze({AccountClient,create:options=>new AccountClient(options)});
  if(typeof module!=='undefined'&&module.exports)module.exports=root.AetheriaAccount;
})(typeof window!=='undefined'?window:globalThis);
