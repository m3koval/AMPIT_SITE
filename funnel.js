(function(){
  var C=window.FUNNEL;if(!C)return;
  var $=function(id){return document.getElementById(id)};
  var CONVERSION='AW-18009085486/ILlTCJPv85UdEK6ss4tD';
  var FREE=['gmail.com','googlemail.com','yahoo.com','ymail.com','outlook.com','hotmail.com','live.com','msn.com','icloud.com','me.com','aol.com','proton.me','protonmail.com'];
  var qp=new URLSearchParams(location.search);
  var attr={utm_source:qp.get('utm_source')||'',utm_medium:qp.get('utm_medium')||'',utm_campaign:qp.get('utm_campaign')||'',utm_content:qp.get('utm_content')||'',gclid:qp.get('gclid')||''};
  var source=(function(){
    if(attr.utm_source)return attr.utm_source.toLowerCase();
    if(attr.gclid)return 'google-ads';
    if(qp.get('oppref'))return 'chatgpt-ads';
    try{var h=document.referrer?new URL(document.referrer).hostname.replace(/^www\./,''):'';if(h&&h.indexOf('ampitsolutions.com')===-1)return h;}catch(e){}
    return 'direct';
  })();
  var answer='',panes=['p-q','p-urgent','p-contact','p-load','p-result'].filter(function(id){return $(id)}),locked=false;

  function track(name,props){
    var p=Object.assign({funnel:C.id,lead_source:source},attr,props||{});
    try{if(typeof gtag==='function')gtag('event',name,p);}catch(e){}
    try{if(window.posthog&&posthog.capture)posthog.capture(name,p);}catch(e){}
  }
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(m){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[m]})}
  function show(id,focusId){
    panes.forEach(function(p){$(p).hidden=(p!==id)});
    var el=$(focusId||id);if(el&&el.focus){try{el.focus({preventScroll:true})}catch(e){}}
    window.scrollTo({top:0,behavior:'smooth'});
  }
  function domainFromEmail(v){var m=String(v||'').trim().toLowerCase().match(/@([a-z0-9.\-]+\.[a-z]{2,})$/);return m?m[1]:'';}
  function cleanDomain(v){return String(v||'').trim().toLowerCase().replace(/^https?:\/\//,'').replace(/^www\./,'').split('/')[0].split(':')[0];}
  function isEmail(v){return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);}

  C.options.forEach(function(o){
    var b=document.createElement('button');
    b.type='button';b.className='q-opt';b.textContent=o.label;
    b.addEventListener('click',function(){
      if(locked)return;locked=true;
      answer=o.label;b.classList.add('picked');
      track('funnel_answered',{answer:o.label,urgent:!!o.urgent});
      setTimeout(function(){
        locked=false;b.classList.remove('picked');
        if(o.urgent&&$('p-urgent')){show('p-urgent','uTitle');track('funnel_urgent_viewed');}
        else{show('p-contact','email');track('funnel_contact_viewed');}
      },220);
    });
    $('qOpts').appendChild(b);
  });
  track('funnel_viewed');

  document.querySelectorAll('[data-back]').forEach(function(b){b.addEventListener('click',function(){show('p-q','qTitle');})});
  document.querySelectorAll('a[href^="tel:"]').forEach(function(a){a.addEventListener('click',function(){track('funnel_cta_clicked',{cta:a.getAttribute('data-cta')||'call'})})});

  if($('email')&&$('domain')){
    $('email').addEventListener('input',function(){
      var d=domainFromEmail($('email').value);
      $('domain').hidden=!(d&&FREE.indexOf(d)!==-1);
    });
  }

  function submitLead(opts){
    var err=opts.err;err.classList.remove('show');
    if(!isEmail(opts.email)){err.textContent='Please enter a valid email.';err.classList.add('show');return;}
    if(opts.requirePhone&&String(opts.phone).replace(/\D/g,'').length<10){err.textContent='Please enter a phone number we can call.';err.classList.add('show');return;}
    var d=domainFromEmail(opts.email);
    var domain=FREE.indexOf(d)!==-1?cleanDomain(opts.website||''):d;
    opts.btn.disabled=true;
    var back=opts.pane;show('p-load');
    var t0=Date.now();
    fetch('/api/email-trust-check',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({domain:domain,email:opts.email,phone:opts.phone||'',source:C.id,lead_source:source,answers:{concern:answer}})})
      .then(function(r){return r.json().catch(function(){return {}}).then(function(j){return {ok:r.ok,data:j}})})
      .then(function(res){
        if(!res.ok)throw new Error((res.data&&res.data.error)||'Something went wrong. Please try again.');
        var data=res.data;
        try{if(window.posthog&&posthog.identify)posthog.identify(opts.email.toLowerCase(),{email:opts.email.toLowerCase(),lead_source:source,first_funnel:C.id});}catch(e){}
        track('funnel_lead_submitted',{answer:answer,callback:!!opts.callback,scanned:!data.skipped,score:data.score||0,lead_recorded:!!data.leadRecorded});
        if(data.leadRecorded){try{if(typeof gtag==='function')gtag('event','conversion',{send_to:CONVERSION});}catch(e){}}
        setTimeout(function(){
          $('p-result').innerHTML=C.renderResult(data,{answer:answer,callback:!!opts.callback,esc:esc,row:row,ctas:CTAS});
          show('p-result','rTitle');
          $('p-result').querySelectorAll('[data-cta]').forEach(function(a){a.addEventListener('click',function(){track('funnel_cta_clicked',{cta:a.getAttribute('data-cta')})})});
        },opts.callback?300:Math.max(0,1800-(Date.now()-t0)));
      })
      .catch(function(ex){
        opts.btn.disabled=false;show(back);
        err.textContent=(ex&&ex.message)||'Something went wrong. Please try again.';err.classList.add('show');
      });
  }

  if($('cForm'))$('cForm').addEventListener('submit',function(e){
    e.preventDefault();
    submitLead({email:$('email').value.trim(),website:$('domain')?$('domain').value:'',btn:$('cBtn'),err:$('cError'),pane:'p-contact'});
  });
  if($('uForm'))$('uForm').addEventListener('submit',function(e){
    e.preventDefault();
    submitLead({email:$('uEmail').value.trim(),phone:$('uPhone').value.trim(),requirePhone:true,callback:true,btn:$('uBtn'),err:$('uError'),pane:'p-urgent'});
  });

  function row(name,tag,cls){return '<div class="q-row '+cls+'"><span>'+esc(name)+'</span><span class="t">'+esc(tag)+'</span></div>';}
  var CTAS='<a class="q-btn" href="/assessment" data-cta="book">Book a free 15-minute call</a><a class="q-btn alt" href="tel:+19803772733" data-cta="call">Call (980) 377-2733</a>';
})();
