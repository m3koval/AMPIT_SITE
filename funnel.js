(function(){
  var C=window.FUNNEL;if(!C)return;
  var $=function(id){return document.getElementById(id)};
  var CONVERSION='AW-18009085486/ILlTCJPv85UdEK6ss4tD';
  var FREE=['gmail.com','googlemail.com','yahoo.com','ymail.com','rocketmail.com','outlook.com','hotmail.com','live.com','msn.com','icloud.com','me.com','mac.com','aol.com','proton.me','protonmail.com','att.net','sbcglobal.net','bellsouth.net','comcast.net','verizon.net','charter.net','spectrum.net','rr.com','cox.net','earthlink.net','frontier.com','windstream.net','mail.com','gmx.com'];
  var qp=new URLSearchParams(location.search);
  var attr={utm_source:qp.get('utm_source')||'',utm_medium:qp.get('utm_medium')||'',utm_campaign:qp.get('utm_campaign')||'',utm_content:qp.get('utm_content')||'',gclid:qp.get('gclid')||''};
  var kw=(qp.get('kw')||'').slice(0,80).replace(/[^\w .+&'\-]/g,'').trim();
  if(kw)attr.keyword=kw;
  var source=(function(){
    if(attr.utm_source)return attr.utm_source.toLowerCase();
    if(attr.gclid)return 'google-ads';
    if(qp.get('oppref'))return 'chatgpt-ads';
    try{var h=document.referrer?new URL(document.referrer).hostname.replace(/^www\./,''):'';if(h&&h.indexOf('ampitsolutions.com')===-1)return h;}catch(e){}
    return 'direct';
  })();
  // Business funnels (C.talk) skip the email gate and the canned plan: one tap, then a 15-minute call or an email.
  if(C.talk&&!$('p-talk')){var tp=document.createElement('section');tp.className='q-pane';tp.id='p-talk';tp.hidden=true;$('p-q').parentNode.appendChild(tp);}
  var answers={},qi=0,panes=['p-q','p-urgent','p-contact','p-load','p-result','p-talk'].filter(function(id){return $(id)}),locked=false;
  var Q=C.questions,loadedAt=Date.now();
  function isVisible(q){return !q.showIf||q.showIf(answers);}
  function visibleQs(){return Q.filter(isVisible);}
  function nextIndex(from,dir){for(var j=from+dir;j>=0&&j<Q.length;j+=dir){if(isVisible(Q[j]))return j;}return -1;}
  function cleanAnswers(){var out={};visibleQs().forEach(function(q){if(answers[q.key])out[q.key]=answers[q.key];});if(C.risk)out.risk=C.risk(out);return out;}

  function track(name,props){
    var p=Object.assign({funnel:C.id,lead_source:source},attr,props||{});
    try{if(typeof gtag==='function')gtag('event',name,p);}catch(e){}
    try{if(window.posthog&&posthog.capture)posthog.capture(name,p);}catch(e){}
  }
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(m){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[m]})}
  function progress(n){
    var bar=$('prog');if(!bar)return;
    if(n<0||Q.length<2||C.progress===false){bar.hidden=true;return;}
    bar.hidden=false;
    var total=visibleQs().length+1;
    if(bar.children.length!==total){bar.innerHTML='';for(var i=0;i<total;i++)bar.appendChild(document.createElement('i'));}
    for(var j=0;j<total;j++)bar.children[j].className=j<=n?'on':'';
  }
  function show(id,focusId){
    panes.forEach(function(p){$(p).hidden=(p!==id)});
    progress(id==='p-q'?visibleQs().indexOf(Q[qi]):id==='p-contact'||id==='p-talk'?visibleQs().length:-1);
    var el=$(focusId||id);if(el&&el.focus){try{el.focus({preventScroll:true})}catch(e){}}
    window.scrollTo({top:0,behavior:'smooth'});
  }
  function domainFromEmail(v){var m=String(v||'').trim().toLowerCase().match(/@([a-z0-9.\-]+\.[a-z]{2,})$/);return m?m[1]:'';}
  function cleanDomain(v){return String(v||'').trim().toLowerCase().replace(/^https?:\/\//,'').replace(/^www\./,'').split('/')[0].split(':')[0];}
  function isEmail(v){return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);}

  function renderQ(){
    var q=Q[qi];
    $('qTitle').innerHTML=typeof q.title==='function'?q.title(answers):q.title;
    var box=$('qOpts');box.innerHTML='';
    var opts=q.options.slice(),hint='';
    if(qi===0&&kw&&C.keywordHints){for(var h=0;h<C.keywordHints.length;h++){if(C.keywordHints[h][0].test(kw)){hint=C.keywordHints[h][1];break;}}}
    if(hint){for(var k=0;k<opts.length;k++){if(opts[k].label===hint){opts.unshift(opts.splice(k,1)[0]);break;}}}
    opts.forEach(function(o){
      var b=document.createElement('button');
      b.type='button';b.className='q-opt'+(o.label===hint?' hint':'');b.textContent=o.label;
      b.addEventListener('click',function(){
        if(locked)return;locked=true;
        answers[q.key]=o.label;b.classList.add('picked');
        track('funnel_answered',{question:q.key,step:visibleQs().indexOf(q)+1,answer:o.label,urgent:!!o.urgent});
        setTimeout(function(){
          locked=false;
          if(o.urgent&&$('p-urgent')){show('p-urgent','uTitle');track('funnel_urgent_viewed');}
          else if(nextIndex(qi,1)>=0){qi=nextIndex(qi,1);renderQ();}
          else if(C.talk){renderTalk();}
          else{show('p-contact','email');track('funnel_contact_viewed');}
        },220);
      });
      box.appendChild(b);
    });
    if($('qBack'))$('qBack').hidden=qi===0;
    show('p-q','qTitle');
  }
  // A page with no questions (e.g. /handoff/) opens straight on the talk screen.
  if(Q.length)renderQ();else if(C.talk)renderTalk();
  track('funnel_viewed');

  if($('qBack'))$('qBack').addEventListener('click',function(){var p=nextIndex(qi,-1);if(p>=0){qi=p;renderQ();}});
  document.querySelectorAll('[data-back]').forEach(function(b){b.addEventListener('click',function(){
    if($('p-urgent')&&!$('p-urgent').hidden){qi=0;}else{qi=nextIndex(Q.length,-1);}
    renderQ();
  })});
  document.querySelectorAll('a[href^="tel:"],a[href^="sms:"]').forEach(function(a){a.addEventListener('click',function(){track('funnel_cta_clicked',{cta:a.getAttribute('data-cta')||'call'})})});

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
    var personal=FREE.indexOf(d)!==-1&&!domain;
    opts.btn.disabled=true;
    var back=opts.pane;show('p-load');
    var t0=Date.now();
    fetch('/api/email-trust-check',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({hp:(document.getElementById('hp')||{}).value||'',elapsed:Date.now()-loadedAt,domain:domain,email:opts.email,phone:opts.phone||'',source:C.id,lead_source:source,keyword:kw,answers:cleanAnswers()})})
      .then(function(r){return r.json().catch(function(){return {}}).then(function(j){return {ok:r.ok,data:j}})})
      .then(function(res){
        if(!res.ok)throw new Error((res.data&&res.data.error)||'Something went wrong. Please try again.');
        var data=res.data;
        try{if(window.posthog&&posthog.identify)posthog.identify(opts.email.toLowerCase(),{email:opts.email.toLowerCase(),lead_source:source,first_funnel:C.id});}catch(e){}
        track('funnel_lead_submitted',{answer:answers.concern||'',risk:cleanAnswers().risk||'',callback:!!opts.callback,scanned:!data.skipped,score:data.score||0,lead_recorded:!!data.leadRecorded,personal_email:personal});
        // Personal-email leads still get recorded and helped, but are not reported to ad platforms so bidding favors business leads.
        if(data.leadRecorded&&!personal){try{if(typeof gtag==='function')gtag('event','conversion',{send_to:CONVERSION});}catch(e){}try{if(typeof oaiq==='function')oaiq('measure','lead_created',{type:'customer_action'});}catch(e){}}
        setTimeout(function(){
          $('p-result').innerHTML=C.renderResult(data,{answer:answers.concern||'',answers:cleanAnswers(),callback:!!opts.callback,esc:esc,row:row,ctas:CTAS});
          $('p-result').insertAdjacentHTML('beforeend','<p class="q-fine q-text">Or text <a href="sms:+19803772733" data-cta="text">(980) 377-2733</a> anytime. We reply as soon as we can.</p>');
          show('p-result','rTitle');
          if(!opts.callback&&C.booking!==false)renderBooking(opts.email.trim(),personal);
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

  var BOOK_CONVERSION='AW-18009085486/ZIP4CKuYzJscEK6ss4tD';
  function nameFromEmail(email){var p=String(email).split('@')[0].replace(/\+.*$/,'').split(/[._\-]+/).filter(Boolean).map(function(x){return x.charAt(0).toUpperCase()+x.slice(1)}).join(' ').trim();return p.length>=2?p.slice(0,100):'Guest';}
  function ymd(d){return d.toLocaleDateString('en-CA',{timeZone:'America/New_York'});}
  function whenLabel(iso){return new Date(iso).toLocaleString('en-US',{timeZone:'America/New_York',weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});}
  // Lets people book the 15-minute intro call right under their result instead of starting over on /assessment.
  function renderBooking(email,personal){
    var res=$('p-result'),bookLink=res.querySelector('[data-cta="book"]'),box=document.createElement('div');
    box.className='q-book';
    box.innerHTML='<p class="q-label">Pick a time for a free 15-minute call</p><div class="q-slots"><span class="q-fine">Loading open times…</span></div>';
    if(bookLink)bookLink.parentNode.insertBefore(box,bookLink);else res.appendChild(box);
    fetch('/api/cal-slots?type=intro-call&from='+ymd(new Date())+'&to='+ymd(new Date(Date.now()+14*864e5)))
      .then(function(r){return r.ok?r.json():{}})
      .then(function(data){
        var picks=[],soon=Date.now()+2*36e5;
        Object.keys(data||{}).sort().some(function(day){
          var t=(data[day]||[]).filter(function(x){return Date.parse(x)>soon});
          if(!t.length)return false;
          picks.push(t[0]);if(t.length>2)picks.push(t[Math.floor(t.length/2)]);
          return picks.length>=6;
        });
        if(!picks.length){box.remove();return;}
        if(bookLink)bookLink.style.display='none';
        var slots=box.querySelector('.q-slots');slots.innerHTML='';
        picks.slice(0,6).forEach(function(iso){
          var b=document.createElement('button');b.type='button';b.className='q-slot';b.textContent=whenLabel(iso);
          b.addEventListener('click',function(){pick(iso,b)});slots.appendChild(b);
        });
        track('funnel_booking_shown',{slots:picks.length});
      })
      .catch(function(){box.remove();});
    function pick(iso,btn){
      box.querySelectorAll('.q-slot').forEach(function(x){x.classList.toggle('sel',x===btn)});
      var c=box.querySelector('.q-book-confirm');
      if(!c){c=document.createElement('div');c.className='q-book-confirm';box.appendChild(c);}
      c.innerHTML='<input class="q-input" type="text" autocomplete="name" placeholder="Your name" aria-label="Your name" maxlength="100"><div class="q-error" role="alert"></div><button class="q-btn" type="button">Book '+esc(whenLabel(iso))+' ET</button>';
      var go=c.querySelector('.q-btn'),err=c.querySelector('.q-error'),nm=c.querySelector('input');
      track('funnel_booking_slot_picked',{slot:iso});
      go.addEventListener('click',function(){
        go.disabled=true;err.classList.remove('show');
        var name=nm.value.trim().length>=2?nm.value.trim():nameFromEmail(email);
        var a=cleanAnswers(),note=('From the '+C.id+' check. '+Object.keys(a).map(function(k){return k+': '+a[k]}).join('; ')+(kw?'; search: '+kw:'')).slice(0,1000);
        fetch('/api/cal-book',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'intro-call',start:iso,name:name,email:email,phone:'',address:'',note:note})})
          .then(function(r){return r.json().catch(function(){return {}}).then(function(j){return {ok:r.ok,data:j}})})
          .then(function(r){
            var bk=(r.data&&(r.data.data||r.data))||{};
            if(!(r.ok&&r.data&&r.data.status==='success'&&(bk.uid||bk.id)))throw new Error('book');
            track('funnel_meeting_booked',{slot:iso,personal_email:personal});
            if(!personal){try{if(typeof gtag==='function')gtag('event','conversion',{send_to:BOOK_CONVERSION});}catch(e){}}
            box.innerHTML='<h3 class="q-booked">You’re booked.</h3><p class="q-sub">'+esc(whenLabel(iso))+' ET, 15 minutes on Google Meet. The invite is on its way to '+esc(email)+'.</p>';
          })
          .catch(function(){
            go.disabled=false;err.textContent='That time didn’t go through. Pick another, or call (980) 377-2733.';err.classList.add('show');
          });
      });
      try{nm.focus({preventScroll:true})}catch(e){}
    }
  }

  function postLead(email){
    var d=domainFromEmail(email),personal=FREE.indexOf(d)!==-1;
    return fetch('/api/email-trust-check',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({hp:($('hp')||{}).value||'',elapsed:Date.now()-loadedAt,domain:personal?'':d,email:email,phone:'',source:C.id,lead_source:source,keyword:kw,answers:cleanAnswers()})})
      .then(function(r){return r.json().catch(function(){return {}}).then(function(j){return {ok:r.ok,data:j}})})
      .then(function(res){
        if(!res.ok)throw new Error((res.data&&res.data.error)||'Something went wrong. Please try again.');
        var data=res.data;
        try{if(window.posthog&&posthog.identify)posthog.identify(email.toLowerCase(),{email:email.toLowerCase(),lead_source:source,first_funnel:C.id});}catch(e){}
        track('funnel_lead_submitted',{answer:answers.concern||'',lead_recorded:!!data.leadRecorded,personal_email:personal,mode:'talk'});
        if(data.leadRecorded&&!personal){try{if(typeof gtag==='function')gtag('event','conversion',{send_to:CONVERSION});}catch(e){}try{if(typeof oaiq==='function')oaiq('measure','lead_created',{type:'customer_action'});}catch(e){}}
        return {personal:personal};
      });
  }

  function renderTalk(){
    var a=cleanAnswers(),T=C.talk,p=$('p-talk');
    p.innerHTML=(a.concern?'<p class="q-label">'+esc(a.concern)+'</p>':'')+
      '<h2 id="tTitle" tabindex="-1">'+(typeof T.title==='function'?T.title(a):T.title)+'</h2>'+
      '<p class="q-sub">'+esc(T.line(a))+'</p>'+
      (T.offer?'<div class="q-offer"><p class="q-label">Free first automation</p><p>'+T.offer+'</p><p class="q-fine">Microsoft 365 or Google Workspace. One per business. We take 4 a month.</p></div>':'')+
      '<div class="q-who"><img src="/images/amp-it-founders-square.jpg" alt="AMP IT founders Mikhail Koval and Nik Kotov" loading="lazy"><p>You’ll talk with Mike or Nik, AMP IT’s founders.</p></div>'+
      '<input class="hp" id="hp" type="text" tabindex="-1" autocomplete="off" aria-hidden="true">'+
      '<div class="q-book q-book-top"><p class="q-label">Pick a time for a free 15-minute call</p><div class="q-slots"><span class="q-fine">Loading open times…</span></div></div>'+
      '<div class="q-divider">or</div>'+
      '<form class="q-mail" novalidate><p class="q-label">Rather email? We’ll write you.</p><input class="q-input" type="email" inputmode="email" autocomplete="email" placeholder="you@yourcompany.com" aria-label="Email"><div class="q-error" role="alert"></div><button class="q-btn alt" type="submit">Email me</button></form>'+
      '<p class="q-fine q-text">Or call or text <a href="tel:+19803772733" data-cta="call">(980) 377-2733</a>.</p>'+
      '<div class="q-foot"><span></span><button class="q-back" type="button">&larr; Back</button></div>';
    show('p-talk','tTitle');
    track('funnel_contact_viewed',{mode:'talk'});
    var bk=p.querySelector('.q-back');if(Q.length)bk.addEventListener('click',function(){qi=nextIndex(Q.length,-1);renderQ();});else bk.remove();
    p.querySelectorAll('[data-cta]').forEach(function(x){x.addEventListener('click',function(){track('funnel_cta_clicked',{cta:x.getAttribute('data-cta')})})});

    var mail=p.querySelector('.q-mail');
    mail.addEventListener('submit',function(e){
      e.preventDefault();
      var inp=mail.querySelector('input'),err=mail.querySelector('.q-error'),btn=mail.querySelector('button'),email=inp.value.trim();
      err.classList.remove('show');
      if(!isEmail(email)){err.textContent='Please enter a valid email.';err.classList.add('show');return;}
      btn.disabled=true;
      postLead(email).then(function(){
        mail.innerHTML='<h3 class="q-booked">Got it.</h3><p class="q-sub">We’ll email you at '+esc(email)+'.</p>';
      }).catch(function(ex){btn.disabled=false;err.textContent=(ex&&ex.message)||'Something went wrong. Please try again.';err.classList.add('show');});
    });

    var box=p.querySelector('.q-book'),slots=box.querySelector('.q-slots');
    fetch('/api/cal-slots?type=intro-call&from='+ymd(new Date())+'&to='+ymd(new Date(Date.now()+14*864e5)))
      .then(function(r){return r.ok?r.json():{}})
      .then(function(data){
        var picks=[],soon=Date.now()+2*36e5;
        Object.keys(data||{}).sort().some(function(day){
          var t=(data[day]||[]).filter(function(x){return Date.parse(x)>soon});
          if(!t.length)return false;
          picks.push(t[0]);if(t.length>2)picks.push(t[Math.floor(t.length/2)]);
          return picks.length>=6;
        });
        if(!picks.length)throw new Error('none');
        slots.innerHTML='';
        picks.slice(0,6).forEach(function(iso){
          var b=document.createElement('button');b.type='button';b.className='q-slot';b.textContent=whenLabel(iso);
          b.addEventListener('click',function(){pick(iso,b)});slots.appendChild(b);
        });
        track('funnel_booking_shown',{slots:picks.length,mode:'talk'});
      })
      .catch(function(){box.remove();var dv=p.querySelector('.q-divider');if(dv)dv.remove();});

    function pick(iso,btn){
      box.querySelectorAll('.q-slot').forEach(function(x){x.classList.toggle('sel',x===btn)});
      var c=box.querySelector('.q-book-confirm');
      if(!c){c=document.createElement('div');c.className='q-book-confirm';box.appendChild(c);}
      c.innerHTML='<input class="q-input" type="text" autocomplete="name" placeholder="Your name" aria-label="Your name" maxlength="100"><input class="q-input" type="email" inputmode="email" autocomplete="email" placeholder="you@yourcompany.com" aria-label="Email for the invite"><div class="q-error" role="alert"></div><button class="q-btn" type="button">Book '+esc(whenLabel(iso))+' ET</button>';
      var ins=c.querySelectorAll('input'),nm=ins[0],em=ins[1],go=c.querySelector('.q-btn'),err=c.querySelector('.q-error');
      track('funnel_booking_slot_picked',{slot:iso,mode:'talk'});
      go.addEventListener('click',function(){
        var email=em.value.trim();err.classList.remove('show');
        if(!isEmail(email)){err.textContent='Please enter a valid email for the invite.';err.classList.add('show');return;}
        go.disabled=true;
        var name=nm.value.trim().length>=2?nm.value.trim():nameFromEmail(email);
        var note=('From the '+C.id+' check. '+Object.keys(a).map(function(k){return k+': '+a[k]}).join('; ')+(kw?'; search: '+kw:'')).slice(0,1000);
        var personal=FREE.indexOf(domainFromEmail(email))!==-1;
        postLead(email).catch(function(){}).then(function(){
          return fetch('/api/cal-book',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'intro-call',start:iso,name:name,email:email,phone:'',address:'',note:note})});
        })
          .then(function(r){return r.json().catch(function(){return {}}).then(function(j){return {ok:r.ok,data:j}})})
          .then(function(r){
            var bk=(r.data&&(r.data.data||r.data))||{};
            if(!(r.ok&&r.data&&r.data.status==='success'&&(bk.uid||bk.id)))throw new Error('book');
            track('funnel_meeting_booked',{slot:iso,personal_email:personal,mode:'talk'});
            if(!personal){try{if(typeof gtag==='function')gtag('event','conversion',{send_to:BOOK_CONVERSION});}catch(e){}}
            box.innerHTML='<h3 class="q-booked">You’re booked.</h3><p class="q-sub">'+esc(whenLabel(iso))+' ET, 15 minutes on Google Meet. The invite is on its way to '+esc(email)+'.</p>';
            ['.q-divider','.q-mail'].forEach(function(s){var x=p.querySelector(s);if(x)x.remove();});
          })
          .catch(function(){
            go.disabled=false;err.textContent='That time didn’t go through. Pick another, or call (980) 377-2733.';err.classList.add('show');
          });
      });
      try{nm.focus({preventScroll:true})}catch(e){}
    }
  }

  function row(name,tag,cls){return '<div class="q-row '+cls+'"><span>'+esc(name)+'</span><span class="t">'+esc(tag)+'</span></div>';}
  var CTAS='<a class="q-btn" href="/assessment" data-cta="book">Book a free 15-minute call</a><a class="q-btn alt" href="tel:+19803772733" data-cta="call">Call (980) 377-2733</a>';
})();
