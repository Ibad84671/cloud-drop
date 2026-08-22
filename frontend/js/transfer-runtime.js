(() => {
  'use strict';
  const MAX_FILES = 100;
  const MAX_TOTAL = 2147483648;
  const cfg = window.CloudDropConfig || {};
  const API = String(cfg.API_BASE || '').replace(/\/$/, '');
  const $ = id => document.getElementById(id);
  const el = {
    input: $('fileInput'), drop: $('dropZone'), browse: $('browseBtn'), list: $('fileList'),
    limit: $('limitText'), upload: $('uploadBtn'), bar: $('uploadBar'), fill: $('progressFill'),
    pct: $('progressPct'), progressText: $('progressText'), share: $('sharePanel'),
    shareLink: $('shareLink'), copy: $('copyBtn'), email: $('emailInput'), send: $('sendEmailBtn'),
    emailFeedback: $('emailFeedback'), reset: $('newTransferBtn'), toast: $('toast')
  };
  if (!el.input || !el.drop || !el.upload || !el.list) return;
  const state = { files: [], transferId: null, completionToken: null, busy: false };
  function toast(message, type='') { if (!el.toast) return; el.toast.textContent=message; el.toast.className=`toast show ${type}`; clearTimeout(toast.t); toast.t=setTimeout(()=>el.toast.className='toast',3200); }
  function human(bytes){ if(bytes<1024)return `${bytes} B`; if(bytes<1048576)return `${(bytes/1024).toFixed(1)} KB`; if(bytes<1073741824)return `${(bytes/1048576).toFixed(1)} MB`; return `${(bytes/1073741824).toFixed(2)} GB`; }
  function totalBytes(){ return state.files.reduce((sum,file)=>sum+file.size,0); }
  function render(){
    el.list.innerHTML='';
    state.files.forEach((file,index)=>{ const row=document.createElement('div'); row.className='file-row'; row.innerHTML='<div class="file-icon" aria-hidden="true">▧</div><span class="file-name"></span><span class="file-size"></span><button class="remove" type="button" aria-label="Remove file">×</button>'; row.querySelector('.file-name').textContent=file.name; row.querySelector('.file-size').textContent=human(file.size); row.querySelector('.remove').addEventListener('click',()=>{if(state.busy)return;state.files.splice(index,1);try{el.input.value='';}catch(_){}render();}); el.list.appendChild(row); });
    el.limit.textContent=state.files.length?`${state.files.length} file${state.files.length===1?'':'s'} · ${human(totalBytes())} / 2GB`:'Up to 2GB · up to 100 files per transfer.';
    el.upload.disabled=state.busy||state.files.length===0;
  }
  function addFiles(incoming){
    if(state.busy)return; const files=Array.from(incoming||[]).filter(f=>f instanceof File); if(!files.length)return;
    const seen=new Set(state.files.map(f=>`${f.name}|${f.size}|${f.lastModified}`)); for(const file of files){const key=`${file.name}|${file.size}|${file.lastModified}`; if(!seen.has(key)){seen.add(key);state.files.push(file);}}
    if(state.files.length>MAX_FILES){state.files=state.files.slice(0,MAX_FILES);toast('Maximum 100 files allowed.','error');}
    if(totalBytes()>MAX_TOTAL){let sum=0,kept=[];for(const file of state.files){if(sum+file.size>MAX_TOTAL)break;kept.push(file);sum+=file.size;}state.files=kept;toast('Total upload size cannot exceed 2GB.','error');}
    render();
  }
  function setProgress(percent,label){const p=Math.max(0,Math.min(100,percent));el.bar.classList.add('show');el.fill.style.width=`${p}%`;el.pct.textContent=`${Math.round(p)}%`;el.progressText.textContent=label;}
  async function api(path,options={}){if(!API)throw new Error('CloudDrop API is not configured.');const response=await fetch(API+path,{...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data?.error?.message||data?.message||`Request failed (${response.status}).`);return data;}
  function putObject(url,file,onProgress){return new Promise((resolve,reject)=>{const xhr=new XMLHttpRequest();xhr.open('PUT',url);xhr.setRequestHeader('Content-Type',file.type||'application/octet-stream');xhr.upload.onprogress=e=>{if(e.lengthComputable)onProgress(e.loaded/e.total);};xhr.onload=()=>xhr.status>=200&&xhr.status<300?resolve():reject(new Error(`Upload failed for ${file.name} (${xhr.status}).`));xhr.onerror=()=>reject(new Error(`Network error uploading ${file.name}.`));xhr.send(file);});}
  async function uploadTransfer(){
    if(state.busy||!state.files.length)return; state.busy=true; render(); setProgress(0,'Creating secure transfer…');
    try{
      const created=await api('/batch',{method:'POST',body:JSON.stringify({files:state.files.map(file=>({fileName:file.name,fileSize:file.size,contentType:file.type||'application/octet-stream'})))});
      const data=created.data||created; state.transferId=data.transferId; state.completionToken=data.completionToken; const uploads=data.uploads||[];
      if(!state.transferId||!state.completionToken||uploads.length!==state.files.length)throw new Error('Upload service returned an unexpected transfer payload.');
      const total=totalBytes()||1; let completed=0;
      for(let i=0;i<state.files.length;i++){const file=state.files[i],item=uploads[i];if(!item?.uploadUrl)throw new Error(`No upload URL returned for ${file.name}.`);setProgress((completed/total)*100,`Uploading ${i+1} of ${state.files.length}…`);await putObject(item.uploadUrl,file,ratio=>setProgress(((completed+file.size*ratio)/total)*100,`Uploading ${i+1} of ${state.files.length}…`));completed+=file.size;}
      setProgress(100,'Finalizing transfer…'); await api(`/batch/${encodeURIComponent(state.transferId)}/complete`,{method:'POST',headers:{'X-Completion-Token':state.completionToken},body:'{}'});
      state.completionToken=null;
      el.shareLink.value=new URL(`/t/${encodeURIComponent(state.transferId)}`,window.location.origin).toString();el.share.classList.add('show');toast('Transfer created successfully.','success');el.share.scrollIntoView({behavior:'smooth',block:'nearest'});
    }catch(error){el.progressText.textContent='Upload failed.';toast(error?.message||'Unable to complete the transfer.','error');}finally{state.busy=false;render();}
  }
  async function copyLink(){const link=el.shareLink.value;if(!link)return;try{await navigator.clipboard.writeText(link);}catch(_){el.shareLink.focus();el.shareLink.select();document.execCommand('copy');}el.copy.textContent='Copied';toast('Share link copied.','success');setTimeout(()=>el.copy.textContent='Copy link',1400);}
  async function sendEmail(){if(!state.transferId)return;const to=el.email.value.trim();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)){el.emailFeedback.textContent='Enter a valid recipient email.';el.emailFeedback.className='email-feedback err';el.email.focus();return;}el.send.disabled=true;el.emailFeedback.textContent='Sending…';el.emailFeedback.className='email-feedback';try{await api('/send-email',{method:'POST',body:JSON.stringify({to,transferId:state.transferId})});el.emailFeedback.textContent='Email sent successfully.';el.emailFeedback.className='email-feedback ok';toast('Share link sent by email.','success');}catch(error){el.emailFeedback.textContent=error?.message||'Email delivery failed.';el.emailFeedback.className='email-feedback err';toast(error?.message||'Email delivery failed.','error');}finally{el.send.disabled=false;}}
  function reset(){state.files=[];state.transferId=null;state.completionToken=null;state.busy=false;el.input.value='';el.share.classList.remove('show');el.shareLink.value='';el.email.value='';el.emailFeedback.textContent='';el.emailFeedback.className='email-feedback';el.bar.classList.remove('show');el.fill.style.width='0%';el.pct.textContent='0%';render();window.scrollTo({top:0,behavior:'smooth'});}
  function stop(e){e.preventDefault();e.stopImmediatePropagation();}
  document.addEventListener('dragover',e=>{e.preventDefault();if(e.dataTransfer)e.dataTransfer.dropEffect='copy';},true);
  document.addEventListener('drop',e=>{if(!el.drop.contains(e.target))e.preventDefault();},true);
  el.input.addEventListener('change',e=>{stop(e);addFiles(e.target.files);},true);
  el.browse.addEventListener('click',e=>{stop(e);el.input.click();},true);
  el.drop.addEventListener('click',e=>{if(e.target.closest('#browseBtn'))return;stop(e);el.input.click();},true);
  el.drop.addEventListener('dragenter',e=>{stop(e);el.drop.classList.add('drag');},true);
  el.drop.addEventListener('dragover',e=>{stop(e);el.drop.classList.add('drag');},true);
  el.drop.addEventListener('dragleave',e=>{e.preventDefault();if(!e.relatedTarget||!el.drop.contains(e.relatedTarget))el.drop.classList.remove('drag');},true);
  el.drop.addEventListener('drop',e=>{stop(e);el.drop.classList.remove('drag');addFiles(e.dataTransfer?.files);},true);
  el.drop.addEventListener('keydown',e=>{if(e.key!=='Enter'&&e.key!==' ')return;stop(e);el.input.click();},true);
  el.upload.addEventListener('click',e=>{stop(e);uploadTransfer();},true);
  el.copy.addEventListener('click',e=>{stop(e);copyLink();},true);
  el.send.addEventListener('click',e=>{stop(e);sendEmail();},true);
  el.email.addEventListener('keydown',e=>{if(e.key==='Enter')sendEmail();},true);
  el.reset.addEventListener('click',e=>{stop(e);reset();},true);
  render();
})();
