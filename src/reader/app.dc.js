
class Component extends DCLogic {
  constructor(props){
    super(props);
    this.PROXY='https://n8n.intelechia.com/webhook';
    this.STOP=new Set('the a an of to in on at for and or but with by from as is are was were be been being this that these those it its their his her our your they we you i he she him them us me year years some most many few what who whom which when where how why than then so if not no nor only also just very more less new over under into out up down off above below'.split(' '));
    this.MONTHS=new Set('january february march april may june july august september october november december jan feb mar apr jun jul aug sept sep oct nov dec'.split(' '));
    this.DOW=new Set('monday tuesday wednesday thursday friday saturday sunday mon tue tues wed thu thur thurs fri sat sun'.split(' '));
    this.TEMPORAL=new Set('today yesterday tomorrow morning afternoon evening night noon midnight week weeks month months year years day days hour hours minute minutes second seconds decade decades century centuries quarter weekday weekend weekends am pm utc gmt est pst date dates time times'.split(' '));
    // Common adjectives / nouns that frequently OPEN a sentence or title and so get a
    // stray capital ("Soft coral…", "Deep reefs…"). Used only with the positional test.
    this.COMMON_OPENER=new Set('soft hard new old great small large big high low good bad deep shallow light dark long short full empty open close closed free real true false main key top best worst early late recent modern ancient warm cold hot cool dry wet rich poor strong weak fast slow young many most other several various such few more less same different general common special major minor local global natural human social public private red blue green white black grey gray brown clear bright wide narrow thick thin heavy soft northern southern eastern western central upper lower inner outer first second third final next last whole half single double total active passive primary secondary'.split(' '));
    this.SUGG=[];  // filled on mount by loadSuggestions(): a random Wikipedia page + random English books
    this.PALETTE=['#2563eb','#7c3aed','#0e7490','#b45309','#dc2626','#15803d','#be185d','#4f46e5','#0891b2','#9333ea'];
    this.THEMES=[{name:'EO Violet',hex:'#5b34d6'},{name:'Indigo',hex:'#4f46e5'},{name:'Royal',hex:'#2563eb'},{name:'Teal',hex:'#0d9488'},{name:'Forest',hex:'#15803d'},{name:'Magenta',hex:'#be185d'},{name:'Amber',hex:'#b45309'},{name:'Slate',hex:'#475569'}];
    let savedAccent=null,savedHL=null,savedAudit=null,savedHoverPivot=null,savedClickAct=null,savedHoverDelay=null,savedLink=null;try{savedAccent=localStorage.getItem('eo_accent');savedHL=localStorage.getItem('eo_highlight');savedAudit=localStorage.getItem('eo_audit');savedHoverPivot=localStorage.getItem('eo_hoverpivot');savedClickAct=localStorage.getItem('eo_clickact');savedHoverDelay=localStorage.getItem('eo_hoverdelay');savedLink=localStorage.getItem('eo_linkmode');}catch(e){}
    this._busy=false; this._svoRun=0; this._panelStack=[]; this._gzDrag=null; this._gzMoved=false;
    this._muted=new Set(); try{this._muted=new Set(JSON.parse(localStorage.getItem('eo_muted')||'[]'));}catch(e){}
    this.state={ ready:false, engineErr:null, pages:[], selId:null, query:'', url:'', busy:false, feed:[],
      panelW:380, gz:{k:1,x:0,y:0},
      hoverSrc:null, pinSrc:null, openSrc:null, mode:'breadth', direction:'', hoverEnt:null, hoverHref:null, hoverXY:{x:0,y:0}, rev:0, sortMode:'updated',
      llm:true, llmAvail:false, svoBusy:false, svoStatus:'', pasteOpen:false, pasteText:'',
      srcWide:false, srcTab:'page', srcDoc:null, srcLoading:false, srcErr:null, linkMode:savedLink==='0'?false:true, linkChoice:null,
      viewUrl:null, detect:true, pageDoc:null, pageLoading:false, pageErr:null, rightOpen:true, panelSel:null, panelLens:null, panelMode:'overview', previewWiki:null, memOpen:false, memTab:'sources', memExpand:null,
      accent:savedAccent||null, highlightStyle:savedHL||'marker', settingsOpen:false,
      hoverPivot:savedHoverPivot||'dwell', clickAction:savedClickAct||'ask', hoverDelay:Math.max(150,Math.min(2000,+savedHoverDelay||1100)),
      auditMode:savedAudit==='1', auditCollapsed:false, auditCopied:false, provOpen:false, panelProvOpen:false,
      hoverCite:null, liveResearch:{on:false},
      leftOpen:true, openGroups:{}, summaries:{}, wikiDefs:{}, learnedOpen:false,
      // Chat — first-class alongside sources. Each chat is a thread grounded in what
      // has been read; answers are built from the read graph/sentences (no LLM; an
      // LLM refines them only if window.claude is present). Chats live in the left panel.
      chats:[], activeChat:null, chatInput:'', chatBusy:false,
      // Project Gutenberg — "a source of sources". A non-URL query searches the catalog;
      // a chosen book is fetched and READ FULLY before it joins the sources (and so can
      // be chatted with). gutenReading holds the id while a book is being read.
      gutenResults:null, gutenLoading:false, gutenQuery:'', gutenReading:null,
      // Panel layout: swap the left (sources/chats) and right (entities) sides.
      swapped:(()=>{try{return localStorage.getItem('eo_swap')==='1';}catch(e){return false;}})(),
      // Chat model — like the old app. Loaded lazily on first chat; grounded in what
      // you've read when relevant, a normal assistant otherwise. Falls back to a
      // structural answer if the model can't load.
      backend:(()=>{try{return localStorage.getItem('eo_backend')||'webllm';}catch(e){return 'webllm';}})(), modelStatus:'' };
  }
  // ── theme helpers ─────────────────────────────────────────────────────
  _hx(h){h=String(h||'').replace('#','');if(h.length===3)h=h.split('').map(c=>c+c).join('');const n=parseInt(h,16);return {r:(n>>16)&255,g:(n>>8)&255,b:n&255};}
  mixWhite(hex,amt){const c=this._hx(hex);const m=v=>Math.round(v+(255-v)*amt);return 'rgb('+m(c.r)+','+m(c.g)+','+m(c.b)+')';}
  hexA(hex,a){const c=this._hx(hex);return 'rgba('+c.r+','+c.g+','+c.b+','+a+')';}
  curAccent(){return this.state.accent||(this.props&&this.props.accent)||'#5b34d6';}
  setAccent(hex){try{localStorage.setItem('eo_accent',hex);}catch(e){}this._decoToken=null;this.setState({accent:hex});}
  setHighlight(s){try{localStorage.setItem('eo_highlight',s);}catch(e){}this._decoToken=null;this.setState({highlightStyle:s});}
  setHoverPivot(v){try{localStorage.setItem('eo_hoverpivot',v);}catch(e){}this.setState({hoverPivot:v});}
  setClickAction(v){try{localStorage.setItem('eo_clickact',v);}catch(e){}this.setState({clickAction:v});}
  setHoverDelay(v){v=Math.max(150,Math.min(2000,+v||1100));try{localStorage.setItem('eo_hoverdelay',String(v));}catch(e){}this.setState({hoverDelay:v});}
  toggleSettings(){this.setState(s=>({settingsOpen:!s.settingsOpen}));}
  closeSettings(){this.setState({settingsOpen:false});}
  toggleAudit(){const v=!this.state.auditMode;try{localStorage.setItem('eo_audit',v?'1':'0');}catch(e){}this.setState({auditMode:v});}
  // ── audit helpers: term sets + fold↔wiki referent comparison ──────────
  auditTerms(s){const out=new Set();String(s||'').toLowerCase().split(/[^a-z0-9]+/).forEach(w=>{if(w.length>=4&&!this.STOP.has(w))out.add(w);});return out;}
  defCompare(fold,wiki){const A=this.auditTerms(fold),B=this.auditTerms(wiki);if(!A.size||!B.size)return null;
    const shared=[...A].filter(w=>B.has(w)),aOnly=[...A].filter(w=>!B.has(w)),bOnly=[...B].filter(w=>!A.has(w));
    const uni=new Set([...A,...B]);return {pct:Math.round(100*shared.length/uni.size),shared,aOnly,bOnly};}

  async componentDidMount(){
    const __res=(typeof window!=='undefined'&&window.__resources)||{};
    try{ this.E=await import(__res.eoEngine||'./eoreader4-bundle.js'); }
    catch(e){ this.setState({ready:true,engineErr:String(e)}); return; }
    try{ this.SVO=await import(__res.eoSvo||'./svo-llm.js'); }catch(e){ this.SVO=null; }
    const llmAvail=!!(this.SVO && typeof window!=='undefined' && window.claude && typeof window.claude.complete==='function');
    this.setState({ready:true, llmAvail, llm:llmAvail});
    // Start the chat model downloading immediately so it's ready by the time the first
    // question is asked (progress is throttled in ensureChatModel to keep typing smooth).
    if(this.state.backend!=='echo') this.ensureChatModel().catch(()=>{});
    // An explicit seed URL reads on load; otherwise we stay empty and just OFFER a random
    // Wikipedia page + a few random English books as suggestions (loaded only when clicked).
    const seed=(this.props&&this.props.seedUrl);
    if(seed) this.readURL(seed,'read');
    else this.loadSuggestions();
  }
  // ── Default suggestions: a random Wikipedia page + a few random English books ──
  // Nothing is read on load — the start screen stays empty (like before, with the
  // Great Barrier Reef suggestion), only now the suggestions are RANDOM: one Wikipedia
  // article and a few English Project Gutenberg books, each loaded only when clicked.
  async loadSuggestions(){
    const sugg=[];
    try{
      const j=await this._wikiJSON('https://en.wikipedia.org/w/api.php?action=query&list=random&rnnamespace=0&rnlimit=1&format=json&origin=*');
      const r=j&&j.query&&j.query.random&&j.query.random[0];
      if(r&&r.title){
        const url='https://en.wikipedia.org/wiki/'+encodeURIComponent(String(r.title).replace(/ /g,'_'));
        sugg.push({label:r.title+' (Wikipedia)',url});
      }
    }catch(e){}
    try{(await this.randomBooks(3)).forEach(b=>sugg.push({label:b.title+' — '+b.author,book:b}));}catch(e){}
    if(sugg.length){this.SUGG=sugg;this.setState(s=>({rev:s.rev+1}));}
  }
  // Fetch a handful of random ENGLISH Gutenberg books (no reading) for the suggestions.
  // A random page of the catalog gives variety; we shuffle and keep the first N with text.
  async randomBooks(n){
    n=n||3;
    const page=1+Math.floor(Math.random()*40);
    let data;
    try{const r=await fetch(this.PROXY+'/feed?url='+encodeURIComponent('https://gutendex.com/books/?languages=en&page='+page));if(!r.ok)throw new Error('HTTP '+r.status);data=JSON.parse(await r.text());}
    catch(e){return [];}
    const books=this._gutenBooks(data);
    for(let i=books.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));const t=books[i];books[i]=books[j];books[j]=t;}
    return books.slice(0,n);
  }

  norm(s){return (s||'').replace(/\s+/g,' ').trim();}
  short(u){try{return new URL(u).hostname.replace(/^www\./,'');}catch(e){return String(u).slice(0,30);}}
  // Humanize a publisher host into a readable VOICE name — "en.wikipedia.org" → "Wikipedia".
  // A take is subjective: it has to be FROM somebody. When no person/org is cited inside
  // the text, the publisher itself is the voice making the claim, so it must read like a name.
  voicePretty(host){
    const h=String(host||'').replace(/^www\./,'').toLowerCase();
    const map={'wikipedia.org':'Wikipedia','wikiquote.org':'Wikiquote','wiktionary.org':'Wiktionary','britannica.com':'Britannica','nytimes.com':'The New York Times','washingtonpost.com':'The Washington Post','theguardian.com':'The Guardian','bbc.com':'BBC','bbc.co.uk':'BBC','reuters.com':'Reuters','apnews.com':'Associated Press','npr.org':'NPR','nature.com':'Nature','sciencemag.org':'Science','nasa.gov':'NASA','noaa.gov':'NOAA','who.int':'the WHO','un.org':'the UN','unesco.org':'UNESCO','cnn.com':'CNN','forbes.com':'Forbes','economist.com':'The Economist','wsj.com':'The Wall Street Journal','ft.com':'Financial Times','nationalgeographic.com':'National Geographic','smithsonianmag.com':'Smithsonian','scientificamerican.com':'Scientific American'};
    for(const k in map){if(h===k||h.endsWith('.'+k))return map[k];}
    const core=h.replace(/\.(com|org|net|edu|gov|io|co|info|us|uk)(\.[a-z]{2})?$/,'').split('.').pop()||h;
    return core.charAt(0).toUpperCase()+core.slice(1);
  }
  // ── relation verb → grammatical 3rd-person-singular predicate so the
  // neighbour list reads "barrier reef becomes", not "barrier reef become". ─
  relVerb(v){
    v=this.norm(v||'').toLowerCase();if(!v)return 'related to';
    const parts=v.split(/\s+/);let w=parts[0];
    const IRR={be:'is',have:'has',do:'does',go:'goes',say:'says',is:'is',are:'are',was:'was',were:'were'};
    const skip=/(s|x)$|ed$|ing$|^(related|named|based|owned|led|founded|run|met|known|near|part|within|inside|amid|under|over|with|to|from|of|by|at|in|on|like|as)$/;
    if(IRR[w])w=IRR[w];
    else if(!skip.test(w)){
      if(/[^aeiou]y$/.test(w))w=w.slice(0,-1)+'ies';
      else if(/(ch|sh|ss|x|z|o)$/.test(w))w=w+'es';
      else w=w+'s';
    }
    parts[0]=w;return parts.join(' ');
  }
  initials(n){return this.norm(n).replace(/[()]/g,'').split(/\s+/).slice(0,2).map(w=>w[0]||'').join('').toUpperCase()||'?';}
  hashColor(s){let h=0;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;return this.PALETTE[h%this.PALETTE.length];}
  fmtTime(ts){try{return new Date(ts).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});}catch(e){return '';}}
  isURLish(l){l=String(l||'');return /^https?:\/\//i.test(l)||/\/\//.test(l)||/^www\./i.test(l)||l.length>64;}
  junkRel(v){if(v==null)return true;v=String(v).toLowerCase().trim();if(this.STOP.has(v))return true;if(v.replace(/[^a-z]/gi,'').length<2)return true;return false;}

  extract(raw,ctype,url){
    const head=String(raw||'').slice(0,3000);
    const looksHtml=/<\s*(!doctype|html|body|article|main|div|p|h[1-6]|table|section|span)\b/i.test(head);
    if((ctype&&/text\/plain/i.test(ctype))||!looksHtml){ return this.extractPlain(raw); }
    const doc=new DOMParser().parseFromString(raw,'text/html');
    let image=this._ogImage(doc); if(image&&url){try{image=new URL(image,url).href;}catch(e){}}
    doc.querySelectorAll('script,style,nav,footer,header,aside,noscript,form,iframe,svg,button,textarea,label,select,template').forEach(n=>n.remove());
    // Newsroom chrome by class/id: audio-player embeds, newsletter sign-ups, share/social
    // bars, "related stories" rails. These leak markup ("Embed <iframe …>") and boilerplate
    // ("Download Embed Embed", "Stay up to date with our newsletter") into the read text.
    doc.querySelectorAll('[class],[id]').forEach(n=>{const k=((n.getAttribute('class')||'')+' '+(n.getAttribute('id')||'')).toLowerCase();
      if(/(^|[-_ ])(embed|newsletter|subscribe|share|social|related|promo|advert|paywall|player|disqus|comments?)([-_ ]|$)/.test(k))n.remove();});
    const title=this.norm((doc.querySelector('title')||{}).textContent||'')||'(untitled)';
    const main=doc.querySelector('main,article,[role=main]')||doc.body||doc.documentElement;
    // The page's own hyperlinks are ground truth: each <a> to a Wikipedia article tells
    // us BOTH that its text is an entity of interest AND exactly which article it means.
    // We bind to this directly later — no searching, no guessing (CNN → /wiki/CNN, never CNN+).
    const wikiLinks={};
    main.querySelectorAll('a[href]').forEach(a=>{
      let href=a.getAttribute('href')||'';if(!href||href[0]==='#')return;
      try{href=new URL(href,url||'https://en.wikipedia.org/').href;}catch(e){return;}
      const base=href.split('#')[0].split('?')[0];
      const m=base.match(/^https?:\/\/[a-z.]*wikipedia\.org\/wiki\/([^:]+)$/i);if(!m)return;
      const t=this.norm(a.textContent||'').toLowerCase();
      if(t.length>=2&&t.length<=60&&!wikiLinks[t])wikiLinks[t]=base;
    });
    const blocks=[...main.querySelectorAll('h1,h2,h3,h4,p,li,blockquote,dd,td,figcaption')].map(n=>this._chromify(this._decruft(this.norm(n.textContent).replace(/https?:\/\/\S+/g,'').replace(/\s+/g,' ').trim()))).filter(t=>t.length>2&&!this._isCreditOnly(t));
    if(blocks.length<2){ const body=this._chromify(this.norm(main.textContent||'')); if(body.length>=120) return {title,text:this.paras(body).slice(0,60000),image,wikiLinks}; }
    return {title,text:[...new Set(blocks)].join('\n').slice(0,60000),image,wikiLinks};
  }
  // Strip newsroom photo chrome that otherwise gets read as prose and poisons the
  // entity summaries ("Adrian Naranjo/AP hide caption …", "Juan Barreto/Getty Images …").
  _decruft(t){
    if(!t)return '';
    t=t.replace(/\b(?:hide|toggle|show)\s+caption\b/gi,' ').replace(/\benlarge this image\b/gi,' ');
    t=t.replace(/^\s*[A-Z][A-Za-z.'\u00C0-\u024F-]+(?:\s+[A-Z][A-Za-z.'\u00C0-\u024F-]+){0,3}\s*\/\s*(?:Getty(?:\s+Images)?|AP|Reuters|AFP|NPR|EPA|Bloomberg|AFP\/Getty)\b[\s,:\-]*/,' ');
    t=t.replace(/\b[A-Z][A-Za-z.'\u00C0-\u024F-]+(?:\s+[A-Z][A-Za-z.'\u00C0-\u024F-]+){0,3}\s+for\s+NPR\b[\s,:\-]*/g,' ');
    return this.norm(t);
  }
  _isCreditOnly(t){
    if(!t)return true;
    if(/^(?:hide caption|toggle caption|enlarge this image|advertisement|sponsored content?)\b/i.test(t))return true;
    if(/^(?:download|embed|transcript|listen|loading|play|pause|share|subscribe|sign up|sign in|log in|newsletter|advertisement|read more|see all)\b[\s.\u00B7|-]*$/i.test(t))return true;
    if(t.length<60&&/^[A-Z][A-Za-z.'\u00C0-\u024F-]+(?:\s+[A-Z][A-Za-z.'\u00C0-\u024F-]+){0,3}\s*\/\s*(?:Getty|AP|Reuters|AFP|NPR|EPA|Bloomberg)/.test(t))return true;
    return false;
  }
  // Reader-mode cleanup for an extracted block: drop any HTML markup that leaked in as
  // literal text (audio-player <iframe> snippets shown for copying), strip reference and
  // edit markers ([21], [citation needed], [edit]) and the "Download Embed Embed"/"Embed"
  // audio chrome, and collapse whitespace. Prose is left intact.
  _chromify(t){
    if(!t)return '';
    t=String(t).replace(/<[^>]*>/g,' ');                                  // leaked HTML tags
    t=t.replace(/\[(?:\d+|citation needed|edit|note \d+|\?)\]/gi,'');     // wiki refs / [edit]
    t=t.replace(/\bDownload\s+Embed\b[\s\S]{0,400}?\bTranscript\b/gi,' '); // NPR audio-player chrome block
    t=t.replace(/\bDownload\s+Embed(?:\s+Embed)?\b/gi,' ').replace(/\bEmbed\s+Embed\b/gi,' ');
    return this.norm(t);
  }
  _ogImage(doc){
    const sel=['meta[property="og:image:secure_url"]','meta[property="og:image"]','meta[name="og:image"]','meta[name="twitter:image"]','meta[property="twitter:image"]','meta[name="twitter:image:src"]','link[rel="image_src"]'];
    for(const s of sel){const el=doc.querySelector(s);const v=el&&(el.getAttribute('content')||el.getAttribute('href'));if(v&&v.trim())return v.trim();}
    const im=doc.querySelector('article img, main img, figure img, img');
    if(im){const v=im.getAttribute('src')||im.getAttribute('data-src')||im.getAttribute('data-original');if(v&&!/^data:/.test(v))return v;}
    return null;
  }
  // Plain-text source (.txt, Project Gutenberg, pasted prose): strip common
  // boilerplate, lift a Title: line if present, group blank-line paragraphs.
  extractPlain(raw){
    let t=String(raw||'').replace(/\r\n?/g,'\n');
    let title=null; const tm=t.match(/^\s*Title:\s*(.+)$/mi); if(tm)title=this.norm(tm[1]);
    const sm=t.match(/\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG[^\n]*\*\*\*/i); if(sm)t=t.slice(sm.index+sm[0].length);
    const em=t.match(/\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG[^\n]*\*\*\*/i); if(em)t=t.slice(0,em.index);
    if(!title){ const fl=t.split('\n').map(s=>this.norm(s)).find(s=>s.length>2); title=fl?this.truncLabel(fl,60):'(untitled text)'; }
    return {title,text:this.paras(t).replace(/<[^>]*>/g,' ').replace(/\[(?:\d+|citation needed|edit)\]/gi,'').slice(0,60000),image:null};
  }
  paras(t){ return String(t||'').split(/\n\s*\n/).map(p=>this.norm(p.replace(/\n/g,' '))).filter(p=>p.length>2).join('\n'); }
  async fetchPage(url){const r=await fetch(this.PROXY+'/feed?url='+encodeURIComponent(url));if(!r.ok)throw new Error('HTTP '+r.status);const html=await r.text();if(html.trim().length<60)throw new Error('empty page');if(/<title>\s*(?:just a moment|attention required|access denied|verify you are human|are you a robot|enable javascript|please wait\b|checking your browser)/i.test(html))throw new Error('blocked by anti-bot check');return this.extract(html,r.headers.get('content-type')||'',url);}
  async searchLinks(query,n){
    const r=await fetch(this.PROXY+'/feed?url='+encodeURIComponent('https://html.duckduckgo.com/html/?q='+encodeURIComponent(query)));
    if(!r.ok)throw new Error('HTTP '+r.status);
    const doc=new DOMParser().parseFromString(await r.text(),'text/html');const out=[];
    const grab=a=>{let h=a.getAttribute&&a.getAttribute('href');if(!h)return;const m=h.match(/[?&]uddg=([^&]+)/);if(m)h=decodeURIComponent(m[1]);if(/^https?:\/\//i.test(h)&&!/duckduckgo\.com/i.test(h))out.push(h);};
    doc.querySelectorAll('a.result__a, .result__title a').forEach(grab);
    if(!out.length)doc.querySelectorAll('a[href]').forEach(grab);
    return [...new Set(out)].slice(0,n||4);
  }

  rebuild(pages){
    const m={events:[],sentences:[],sentenceSource:[],pages:[]};
    for(const pg of pages){ if(this._muted&&this._muted.has(pg.url))continue; const so=m.events.length,no=m.sentences.length;
      for(const e of pg.events){const ne={...e,seq:e.seq+so,__page:pg.url};if(e.refSeq!=null)ne.refSeq=e.refSeq+so;if(typeof e.ref==='number')ne.ref=e.ref+so;if(e.argspan!=null)ne.argspan=e.argspan+so;if(e.sentIdx!=null)ne.sentIdx=e.sentIdx+no;m.events.push(ne);}
      pg.sentences.forEach(s=>{m.sentences.push(s);m.sentenceSource.push(pg.url);});
      m.pages.push({url:pg.url,title:pg.title,text:pg.text||'',sentences:pg.sentences||[],ts:pg.ts,via:pg.via,image:pg.image||null,parent:pg.parent||null,wikiLinks:pg.wikiLinks||null,seqStart:so,sentStart:no});
    }
    this.master=m;
    const shim={events:m.events,snapshot:()=>m.events,get length(){return m.events.length;}};
    this.graph=this.E.projectGraph(shim,{cursor:Math.max(0,m.sentences.length-1),rules:this.E.DEFAULT_PROJECTION_RULES});
    this.incident=new Map();for(const e of this.graph.edges){for(const id of [e.from,e.to])this.incident.set(id,(this.incident.get(id)||0)+(e.weight||0));}
  }
  async readURL(url,via,parent){
    if(!this.E)return false;
    url=this.norm(url);if(!/^https?:\/\//i.test(url))url='https://'+url;
    if(this.state.pages.find(p=>p.url===url)){this.feedLine('warn','Already read: '+this.short(url));return false;}
    let ex;try{ex=await this.fetchPage(url);}catch(e){this.feedLine('warn','Couldn’t fetch '+this.short(url)+' — '+e.message);return false;}
    if(!ex.text||ex.text.length<60){this.feedLine('warn',this.short(url)+' — too little text');return false;}
    return this.ingest(url,ex.title,ex.text,via,ex.image,parent,ex.wikiLinks);
  }
  async readText(text,title){
    if(!this.E)return false;
    text=String(text||'').trim(); if(text.length<60){this.feedLine('warn','Too little text to read.');return false;}
    const url='text:'+(Date.now().toString(36)); const ttl=title||('Pasted text · '+text.slice(0,40).replace(/\s+/g,' ').trim()+'…');
    return this.ingest(url,ttl,text,'paste');
  }
  // Import a book / text file: read it, then NAVIGATE the center to it so it opens
  // as a readable book (loadCenter's text: branch) with its entities clickable.
  async importText(text,title){
    const r=await this.readText(text,title);
    if(!r||!r.url){this.feedLine('warn','Could not import that text.');return false;}
    this._srcUrl=null;this._pushLoc({t:'web',url:r.url});
    this.setState(s=>({viewUrl:r.url,selId:null,panelSel:null,panelLens:null,panelMode:'overview',hoverSrc:null,pinSrc:null,hoverEnt:null,activeChat:null,histRev:(s.histRev||0)+1}));
    this.loadCenter(r.url);
    this.feedSep('imported a book');this.feedLine('read','Read “'+r.title+'” · '+r.sentenceCount+' propositions');
    return r;
  }
  onImportClick(){const i=document.querySelector('input[data-eo-import]');if(i)i.click();}
  onImportFile(ev){
    const f=ev&&ev.target&&ev.target.files&&ev.target.files[0];if(!f)return;
    const fr=new FileReader();
    fr.onload=()=>{this.importText(String(fr.result||''),f.name.replace(/\.(txt|md|markdown|text)$/i,''));if(ev.target)ev.target.value='';};
    fr.onerror=()=>{this.feedLine('warn','Could not read that file.');};
    fr.readAsText(f);
  }
  // ── Chat — grounded in what's been READ, no LLM ──────────────────────────
  // Each chat is a thread that answers from the read sentences/graph. A chat can be
  // scoped to one source (a fully-read book/page) or range over everything read. The
  // answer quotes the most relevant read sentences and links the entities it found —
  // every claim traces to a source. window.claude, if present, is not required.
  chatId(){this._chatN=(this._chatN||0)+1;return 'c'+Date.now().toString(36)+this._chatN;}
  activeChatObj(){return this.state.chats.find(c=>c.id===this.state.activeChat)||null;}
  // Opening / starting a chat does NOT close the page you're reading — when a page
  // or book is open the chat rides alongside it as a drawer (the page stays the
  // hero); with nothing open the chat takes the center.
  newChat(scopeUrl){
    const id=this.chatId();
    const title=scopeUrl?(((this.pageOf(scopeUrl)||{}).title)||this.short(scopeUrl)):'New chat';
    this.setState(s=>({chats:[{id,title,scope:scopeUrl||null,messages:[],ts:Date.now()},...s.chats],activeChat:id,chatInput:'',rightTab:'chat',rightOpen:true}));
    return id;
  }
  // The discoverable "chat with this page": scope a chat to whatever is open.
  askThisPage(){const u=this.state.viewUrl;this.newChat(u||null);}
  openChat(id){this.setState({activeChat:id,hoverEnt:null,rightTab:'chat',rightOpen:true});}
  // Pull the chat out of the right panel into the main drawer (and back).
  detachChat(){this.setState({chatDock:false});}
  dockChat(){this.setState({chatDock:true,rightTab:'chat',rightOpen:true});}
  closeChat(){this.setState({activeChat:null});}
  onChatInput(ev){this.setState({chatInput:ev&&ev.target?ev.target.value:''});}
  onChatKey(ev){if(ev&&ev.key==='Enter'&&!ev.shiftKey){if(ev.preventDefault)ev.preventDefault();this.sendChat();}}
  _scrollChat(){requestAnimationFrame(()=>{const a=document.getElementById('eo-chat-scroll');if(a)a.scrollTop=a.scrollHeight;});}
  setBackend(name){try{localStorage.setItem('eo_backend',name);}catch(e){}if(this._chatModel&&this._chatModel.id!==name)this._chatModel=null;this.setState({backend:name,modelStatus:''});}
  // Questions a clock answers — handled without any model so they always work.
  mechanicalAnswer(q){const low=q.toLowerCase();
    if(/\b(today'?s date|what'?s? (the )?date|what day is it|current date)\b/.test(low))
      return 'Today is '+new Date().toLocaleDateString(undefined,{weekday:'long',year:'numeric',month:'long',day:'numeric'})+'.';
    if(/\b(what'?s? (the )?time|what time is it|current time)\b/.test(low))
      return 'It is '+new Date().toLocaleTimeString()+'.';
    return null;}
  // The read context for a question, as notes the model can lean on (and the source
  // chips/entities to show). Empty when nothing relevant has been read.
  groundNotes(q,scope){const a=this.answerQuestion(q,scope);
    if(a.refs&&a.refs.length)return {notes:'From what you have read:\n'+a.refs.map(i=>'- '+this.norm(this.master.sentences[i])).join('\n'),entities:a.entities||[],sources:a.sources||[]};
    // No keyword match (e.g. "what is this about?", "explain this page") — fall back to the
    // opening lines of the source in scope (or the page being viewed) so the model speaks
    // from the actual text instead of answering as a blank-slate assistant.
    const src=scope||this.state.viewUrl;
    if(src&&this.master&&this.master.sentences.length){
      const idxs=[];for(let i=0;i<this.master.sentences.length&&idxs.length<8;i++){if(this.master.sentenceSource[i]!==src)continue;const low=this.norm(this.master.sentences[i]).toLowerCase();if(this._proseOk(low))idxs.push(i);}
      if(idxs.length)return {notes:'From what you have read:\n'+idxs.map(i=>'- '+this.norm(this.master.sentences[i])).join('\n'),entities:a.entities||[],sources:[src]};
    }
    return {notes:'',entities:a.entities||[],sources:[]};}
  // Minimal, SAFE markdown → HTML for chat answers (the model replies in markdown:
  // **bold**, lists, `code`, links). Everything is HTML-escaped FIRST, then only a fixed
  // set of tags is emitted, so nothing the model writes can inject raw markup.
  _md(src){
    const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const inline=s=>esc(s)
      .replace(/`([^`]+)`/g,(m,c)=>'<code style="background:rgba(0,0,0,.07);border-radius:4px;padding:1px 4px;font-size:.92em;">'+c+'</code>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,'<a href="$2" target="_blank" rel="noopener noreferrer" style="color:var(--acc);">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g,'$1<em>$2</em>');
    const lines=String(src||'').replace(/\r/g,'').split('\n');
    const out=[];let list=null;
    const flush=()=>{if(list){out.push('<'+list.tag+' style="margin:6px 0;padding-left:20px;">'+list.items.join('')+'</'+list.tag+'>');list=null;}};
    for(const raw of lines){
      const line=raw.trim();let m;
      if(!line){flush();continue;}
      if(m=line.match(/^(#{1,6})\s+(.*)$/)){flush();out.push('<div style="font-weight:700;margin:9px 0 2px;">'+inline(m[2])+'</div>');continue;}
      if(m=line.match(/^[-*]\s+(.*)$/)){if(!list||list.tag!=='ul'){flush();list={tag:'ul',items:[]};}list.items.push('<li>'+inline(m[1])+'</li>');continue;}
      if(m=line.match(/^\d+\.\s+(.*)$/)){if(!list||list.tag!=='ol'){flush();list={tag:'ol',items:[]};}list.items.push('<li>'+inline(m[1])+'</li>');continue;}
      flush();out.push('<p style="margin:6px 0;">'+inline(line)+'</p>');
    }
    flush();return out.join('');
  }
  // Collapse / expand the researched-source subtree under a parent source in the left tree.
  toggleSrcCollapse(url){this.setState(s=>{const c={...(s.collapsedSrc||{})};c[url]=!c[url];return {collapsedSrc:c};});}
  // Lazily load the chat model (the old app's backends). Cached on the instance.
  async ensureChatModel(){
    const name=this.state.backend||'webllm';
    if(this._chatModel&&this._chatModel.id===name)return this._chatModel;
    if(!this._ME)this._ME=await import((typeof window!=='undefined'&&window.__resources&&window.__resources.eoModel)||'./model-entry.js');
    const model=this._ME.createModel(name);
    this.setState({modelStatus:name+' · loading…'});
    // Throttle progress to ~3/sec: the load fires this callback many times a second, and a
    // full re-render on each one makes typing in the chat box stutter while the model loads.
    let lastTick=0,lastPct=-1;
    await model.load(p=>{const pct=Math.round((p&&p.pct||0)*100);const now=Date.now();
      if(pct===lastPct||(now-lastTick<300&&pct<100))return;
      lastTick=now;lastPct=pct;
      this.setState({modelStatus:name+' · '+((p&&p.phase)||'loading')+(pct?(' '+pct+'%'):'')});});
    this._chatModel=model;this.setState({modelStatus:''});
    return model;
  }
  async sendChat(){
    const q=this.norm(this.state.chatInput);if(!q)return;
    const cur=this.activeChatObj();const scope=cur?cur.scope:null;
    const prev=cur?cur.messages.filter(m=>m.text&&!m.pending):[];
    // append the user turn + a pending assistant bubble
    let id=this.state.activeChat;
    this.setState(s=>{let chats=s.chats.slice();let idx=chats.findIndex(c=>c.id===id);
      if(idx<0){id=this.chatId();chats=[{id,title:this.truncLabel(q,40),scope:null,messages:[],ts:Date.now()},...chats];idx=0;}
      const c=chats[idx];const title=c.messages.length?c.title:this.truncLabel(q,40);
      chats[idx]={...c,title,messages:[...c.messages,{role:'user',text:q},{role:'asst',text:'',pending:true}]};
      return {chats,activeChat:id,chatInput:''};});
    this._scrollChat();
    const finish=(patch)=>this.setState(s=>({chats:s.chats.map(c=>{if(c.id!==id)return c;const m=c.messages.slice(),li=m.length-1;if(li>=0&&m[li].role==='asst')m[li]={role:'asst',pending:false,text:'',...patch};return {...c,messages:m};})}),()=>this._scrollChat());
    // 1) clock questions — no model
    const mech=this.mechanicalAnswer(q);if(mech){finish({text:mech});return;}
    // 2) grounded notes from what's been read
    const ground=this.groundNotes(q,scope);
    // 3) the model — normal chat, leaning on the notes when present
    try{
      const model=await this.ensureChatModel();
      const history=prev.slice(-8).map(m=>({role:m.role==='user'?'user':'assistant',content:m.text}));
      const messages=this._ME.buildChatMessages({question:q,history,notes:ground.notes,now:new Date()});
      const raw=await model.phrase(messages,{maxTokens:512,temperature:0.4});
      const text=this.norm(raw)||(ground.notes?this.answerQuestion(q,scope).text:'(no answer)');
      finish({text,entities:ground.entities,sources:ground.sources});
    }catch(e){
      // model unavailable — answer structurally from what's read, or say so plainly
      const fb=this.answerQuestion(q,scope);
      const note=this.state.modelStatus?(' · '+this.state.modelStatus):'';
      finish({text:fb.text,refs:fb.refs,entities:fb.entities,sources:fb.sources,modelNote:'Answered from your reading — the chat model didn’t load'+note+'.'});
      this.setState({modelStatus:''});
    }
  }
  // The grounded answer: rank read sentences by question-term overlap, quote the best,
  // and surface the entities the question names. Scope restricts to one source.
  answerQuestion(q,scope){
    if(!this.master||!this.master.sentences.length)
      return {text:'I haven’t read anything yet. Read a URL or import a book — it has to be read fully — then ask.',refs:[],entities:[],sources:[]};
    const qwords=q.toLowerCase().split(/[^a-z0-9]+/).filter(w=>w.length>2&&!this.STOP.has(w));
    if(!qwords.length) return {text:'Ask about a name, place, or idea from what you’ve read.',refs:[],entities:[],sources:[]};
    const inScope=i=>!scope||this.master.sentenceSource[i]===scope;
    const ents=[];
    if(this.graph)for(const e of this.graph.entities.values()){if(!this.showable(e.id))continue;const lab=this.labelOf(e.id).toLowerCase();if(qwords.some(w=>lab===w||(lab.length>3&&lab.includes(w))||(w.length>3&&w.includes(lab))))ents.push(e.id);}
    const scored=[];
    for(let i=0;i<this.master.sentences.length;i++){if(!inScope(i))continue;const low=this.norm(this.master.sentences[i]).toLowerCase();if(!this._proseOk(low))continue;let v=0;for(const w of qwords)if(low.includes(w))v++;if(v>0)scored.push({i,v});}
    scored.sort((a,b)=>b.v-a.v||a.i-b.i);
    const top=scored.slice(0,3);
    if(!top.length) return {text:'I didn’t find anything about that in what I’ve read.',refs:[],entities:ents.slice(0,6),sources:[]};
    const text=top.map(o=>this.norm(this.master.sentences[o.i])).join(' ');
    const sources=[...new Set(top.map(o=>this.master.sentenceSource[o.i]).filter(Boolean))];
    return {text,refs:top.map(o=>o.i),entities:ents.slice(0,6),sources};
  }
  // View-model for the chat: the left-panel thread list + the active thread, ready
  // for the template. Pure read of state.chats; no engine work here.
  chatVals(base){
    base.chats=(this.state.chats||[]).map(c=>{
      const active=c.id===this.state.activeChat;
      return {id:c.id,title:this.truncLabel(c.title||'New chat',32),
        sub:(c.scope?(this.truncLabel(((this.pageOf(c.scope)||{}).title)||'a source',22)):'all sources')+' · '+Math.ceil(c.messages.length/2)+' Q',
        active,onOpen:()=>this.openChat(c.id),
        rowStyle:'display:flex;align-items:center;gap:9px;padding:8px 11px;border-radius:9px;margin-bottom:3px;cursor:pointer;border:1px solid '+(active?'var(--accline)':'transparent')+';background:'+(active?'var(--accbg)':'transparent')+';'};
    });
    base.hasChats=base.chats.length>0;
    const cur=this.activeChatObj();
    if(!cur)return;
    base.chatOn=true;
    const drawer=!!this.state.viewUrl;   // a page/book is open → chat rides as a drawer
    const msgs=cur.messages.map(m=>{
      const isUser=m.role==='user';
      const sources=(m.sources||[]).map(u=>({label:/^text:/i.test(u)?(this.truncLabel(((this.pageOf(u)||{}).title)||'text',20)):this.short(u),onOpen:()=>this.goWeb(u)}));
      const entities=(m.entities||[]).map(id=>({label:this.labelOf(id),onClick:()=>this.clickEntity(id),
        style:'display:inline-flex;align-items:center;font-size:11px;font-weight:600;color:var(--acc);background:var(--accbg);border:1px solid var(--accline);border-radius:6px;padding:2px 8px;cursor:pointer;margin:3px 4px 0 0;'}));
      const isMd=!isUser&&!m.pending&&!!m.text;   // render the model's markdown; user/pending stay plain
      return {isUser,pending:!!m.pending,text:m.pending?'…':m.text,isMd,plain:!isMd,html:isMd?this._md(m.text):'',
        hasMeta:!isUser&&!m.pending&&(sources.length>0||entities.length>0),
        sources,hasSources:sources.length>0,entities,hasEntities:entities.length>0,
        hasNote:!!m.modelNote,note:m.modelNote||'',
        rowStyle:'display:flex;flex-direction:column;'+(isUser?'align-items:flex-end;':'align-items:flex-start;')+'margin-bottom:15px;',
        bubbleStyle:(isUser?'background:var(--acc);color:#fff;border:1px solid var(--acc);':'background:var(--card);color:'+(m.pending?'var(--ink3)':'var(--ink)')+';border:1px solid var(--line);')+'max-width:80%;padding:11px 14px;border-radius:14px;font-size:14px;line-height:1.55;white-space:pre-wrap;word-break:break-word;'+(m.pending?'animation:eopulse 1.4s infinite;':''),
        noteStyle:'font-size:10.5px;color:var(--ink3);margin-top:5px;max-width:80%;',
        srcRowStyle:'display:flex;flex-wrap:wrap;gap:6px;margin-top:7px;max-width:80%;',
        srcChipStyle:'display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:600;color:var(--ink2);background:var(--app);border:1px solid var(--line2);border-radius:6px;padding:2px 8px;cursor:pointer;'};
    });
    const docked=this.state.chatDock!==false;
    base.chat={title:this.truncLabel(cur.title||'New chat',40),drawer,docked,detached:!docked,
      onDetach:()=>this.detachChat(),onDock:()=>this.dockChat(),
      dockTitle:docked?'Pop the chat out into its own pane':'Dock the chat back into the panel',
      dockGlyph:docked?'⤢':'⤡',
      scopeLabel:cur.scope?(this.truncLabel(((this.pageOf(cur.scope)||{}).title)||this.short(cur.scope),36)):'everything read',
      messages:msgs,empty:msgs.length===0,modelStatus:this.state.modelStatus||'',hasStatus:!!this.state.modelStatus,
      shellStyle:drawer
        ? 'position:absolute;top:0;right:0;bottom:0;width:min(440px,92%);z-index:20;display:flex;flex-direction:column;min-height:0;background:var(--app);border-left:1px solid var(--line);box-shadow:-14px 0 44px rgba(20,24,30,.16);animation:eoslide .18s ease-out;'
        : 'height:100%;display:flex;flex-direction:column;min-height:0;background:var(--app);',
      placeholder:cur.scope?('Ask about “'+this.truncLabel(((this.pageOf(cur.scope)||{}).title)||'this source',24)+'”…'):'Ask anything…'};
  }
  // ── Project Gutenberg — a source of sources ──────────────────────────────
  // Search the catalog (gutendex), fetched through the same proxy. Returns books
  // that have a plain-text edition we can read.
  async searchGutenberg(query){
    const api='https://gutendex.com/books/?search='+encodeURIComponent(query);
    let data;
    try{const r=await fetch(this.PROXY+'/feed?url='+encodeURIComponent(api));if(!r.ok)throw new Error('HTTP '+r.status);data=JSON.parse(await r.text());}
    catch(e){this.feedLine('warn','Gutenberg search failed — '+(e&&e.message||e));return [];}
    return this._gutenBooks(data).slice(0,12);
  }
  // Map a gutendex response to readable books — only those with a plain-text edition.
  _gutenBooks(data){
    return ((data&&data.results)||[]).map(b=>{
      const f=b.formats||{};
      const txt=f['text/plain; charset=utf-8']||f['text/plain; charset=us-ascii']||f['text/plain']||(Object.entries(f).find(([k,v])=>/text\/plain/i.test(k)&&!/\.zip$/i.test(v))||[])[1];
      return {id:b.id,title:b.title,author:(b.authors&&b.authors[0]&&b.authors[0].name)||'Unknown author',txtUrl:txt,downloads:b.download_count||0};
    }).filter(b=>b.txtUrl);
  }
  // Strip Project Gutenberg's license header/footer so only the work is read.
  stripGutenberg(t){
    t=String(t||'').replace(/\r\n/g,'\n');
    const sm=t.match(/\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[\s\S]*?\*\*\*/i);
    if(sm)t=t.slice(sm.index+sm[0].length);
    const em=t.match(/\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK/i);
    if(em)t=t.slice(0,em.index);
    return t.trim();
  }
  // Type a query: a URL is opened; anything else searches Project Gutenberg.
  searchBooks(query){
    this.setState({gutenLoading:true,gutenResults:null,gutenQuery:query,activeChat:null,viewUrl:null,selId:null});
    this.searchGutenberg(query).then(res=>{this.setState({gutenLoading:false,gutenResults:res});if(!res.length)this.feedLine('warn','No books found for “'+query+'”.');});
  }
  // Read a chosen book FULLY (fetch → strip → parse) before it becomes a source.
  // Until the parse completes the book is "reading…" and cannot be chatted with.
  async readGutenberg(book){
    if(this.state.gutenReading)return;
    this.setState({gutenReading:book.id});
    this.feedSep('Project Gutenberg');this.feedLine('read','Fetching “'+book.title+'”…');
    let text;
    try{const r=await fetch(this.PROXY+'/feed?url='+encodeURIComponent(book.txtUrl));if(!r.ok)throw new Error('HTTP '+r.status);text=await r.text();}
    catch(e){this.feedLine('warn','Could not fetch the book — '+(e&&e.message||e));this.setState({gutenReading:null});return;}
    text=this.stripGutenberg(text);
    if(text.length<200){this.feedLine('warn','That edition had too little readable text.');this.setState({gutenReading:null});return;}
    this.feedLine('read','Reading “'+book.title+'” fully — '+Math.round(text.length/1000)+'k chars…');
    await this.sleep(20);                                  // let the feed paint before the synchronous parse
    const r=await this.importText(text,book.title+' — '+book.author);
    this.setState({gutenReading:null,gutenResults:null,gutenQuery:''});
    if(r)this.feedLine('done','Read fully · '+r.sentenceCount+' propositions — ready to chat');
  }
  ingest(url,title,text,via,image,parent,wikiLinks){
    const doc=this.E.parseText(text,{coordSubjects:true});
    // Keep the raw text on the page so an imported book can be re-rendered as a
    // readable book in the center (see _bookHtml / loadCenter's text: branch).
    const page={url,title,text:String(text||''),events:doc.log.snapshot(),sentences:doc.sentences,ts:Date.now(),via:via||'read',_doc:doc,svo:0,image:image||null,parent:parent||null,wikiLinks:wikiLinks||null};
    const pages=[...this.state.pages,page];this.rebuild(pages);
    this.setState(s=>({pages,rev:s.rev+1,selId:s.selId||this.topEntity()}));
    // Second reader: fold the LLM's SVO reading onto the same log, then re-project.
    if(this.state.llm && this.state.llmAvail && this.SVO) this.runSVO(page);
    return {title,sentenceCount:doc.sentences.length,url};
  }
  // A researched page is RELEVANT only if it actually shares a specific referent with
  // the focal entity's PRE-research context (proper-noun set captured before reading).
  // A page about a different "DMC" (Devil May Cry) shares none → it gets set aside.
  pageRelevant(url,proper){
    if(!proper||proper.size<4)return true;                 // too sparse to judge — keep
    const idxs=[];for(let i=0;i<this.master.sentences.length;i++)if(this.master.sentenceSource[i]===url)idxs.push(i);
    if(!idxs.length)return true;
    const stem=w=>w.replace(/ies$/,'y').replace(/(ches|shes|sses|xes)$/,m=>m.slice(0,-2)).replace(/s$/,'');
    const words=new Set();idxs.forEach(i=>this.master.sentences[i].toLowerCase().split(/[^a-z0-9]+/).forEach(w=>{if(w)words.add(stem(w));}));
    let hits=0;proper.forEach(t=>{if(words.has(t))hits++;});
    return hits>=1;
  }
  // Drop a page from the record entirely and re-project — undoes its fold (including any
  // by-label entity merges it caused), as if it had never been read.
  tossPage(url){const pages=this.state.pages.filter(p=>p.url!==url);this.rebuild(pages);this.setState(s=>({pages,rev:s.rev+1}));}
  async runSVO(page){
    if(!page||!page._doc||!this.SVO)return;
    const run=++this._svoRun; const sents=page._doc.sentences;
    let triples=[];
    try{
      triples=await this.SVO.extractSVO(sents,{ claude:window.claude, batchSize:8, maxSentences:56,
        isCancelled:()=>this._svoRun!==run });
    }catch(e){ return; } // silent: the regex reading + grain embedding already stand
    if(this._svoRun!==run){return;} // a newer read superseded this pass
    let res={edges:0};
    try{ res=this.SVO.foldSVO({doc:page._doc,triples}); }catch(e){ return; }
    if(!res.edges){return;}
    page.events=page._doc.log.snapshot(); page.svo=res.edges;
    this.rebuild(this.state.pages);
    this.setState(s=>({rev:s.rev+1}));
  }
  // grain of an edge (Ground · Figure · Pattern) — the proposition embedding tested
  // against the three bands. Read from the argspan cut when present (verb already
  // separated), else from the two endpoint labels. Cached per projection rev.
  edgeGrain(e){
    if(!this.SVO||!this.SVO.grainOfBond)return null;
    if(!this._grainCache||this._grainCacheRev!==this.state.rev){this._grainCache=new Map();this._grainCacheRev=this.state.rev;}
    const key=(e.from||'')+'|'+(e.to||'')+'|'+(e.via||'')+'|'+(e.seq||0);
    if(this._grainCache.has(key))return this._grainCache.get(key);
    let subject=this.labelOf(e.from),object=this.labelOf(e.to);
    const ev=(e.seq!=null&&this.master&&this.master.events[e.seq])||null;
    if(ev&&ev.argspan!=null&&this.master.events[ev.argspan]){const sp=this.master.events[ev.argspan];if(sp.subject&&sp.subject.text)subject=sp.subject.text;if(sp.object&&sp.object.text)object=sp.object.text;}
    const g=this.SVO.grainOfBond({subject,object}).grain;
    this._grainCache.set(key,g);
    return g;
  }
  edgeReader(e){const ev=(e.seq!=null&&this.master&&this.master.events[e.seq])||null;return ev&&ev.reader||'svo-regex';}

  // ── extracted propositions: the SVO triples on the edges, not the source
  // sentences. Reads the argspan cut (subject/verb/object spans) when the reader
  // separated them, else falls back to the bond's endpoints + verb (via).
  edgeTriple(e){
    const ev=(e.seq!=null&&this.master&&this.master.events[e.seq])||null;
    const sp=(ev&&ev.argspan!=null&&this.master.events[ev.argspan])||null;
    const subject=(sp&&sp.subject&&sp.subject.text)?this.norm(sp.subject.text):this.labelOf(e.from);
    const object=(sp&&sp.object&&sp.object.text)?this.norm(sp.object.text):this.labelOf(e.to);
    const verb=(sp&&sp.verb&&sp.verb.text)?this.norm(sp.verb.text):(e.via||e.relType||e.kind||'—');
    const reader=(ev&&ev.reader)||(sp&&sp.reader)||'svo-regex';
    const grain=e.grain||(ev&&ev.grain)||this.edgeGrain(e)||'Figure';
    const conf=(ev&&ev.confidence!=null)?ev.confidence:(e.confidence!=null?e.confidence:0.6);
    const neg=(((ev&&ev.polarity)||e.polarity)==='negative');
    const irr=(((ev&&ev.modality)||e.modality)==='irrealis');
    const speech=((ev&&ev.op==='SIG')||e.op==='SIG'||e.kind==='SIG');
    const u=e.sentIdx!=null?this.master.sentenceSource[e.sentIdx]:null;
    const t={s:subject,v:verb,o:object,grain,reader,conf:Math.round(conf*100)/100};
    if(neg)t.neg=true;if(irr)t.irr=true;if(speech)t.speech=true;
    if(u)t.src=this.srcId(u);if(e.sentIdx!=null)t.sent=e.sentIdx;
    return t;
  }
  entityTriples(id){
    const subj=[],obj=[],seen=new Set();
    for(const e of this.edgesOf(id)){
      if(e.from===e.to)continue;
      if(this.isURLish(this.labelOf(e.from))||this.isURLish(this.labelOf(e.to)))continue;
      const t=this.edgeTriple(e),k=t.s+'|'+t.v+'|'+t.o+'|'+(t.sent==null?'':t.sent);
      if(seen.has(k))continue;seen.add(k);
      (e.from===id?subj:obj).push(t);
    }
    return {subj,obj};
  }

  labelOf(id){const e=this.graph.entities.get(id);return (e&&e.label)||id;}
  conceptual(label){
    const raw=this.norm(label);if(!raw)return false;
    const l=raw.toLowerCase().replace(/[.,;:'"()\u2019\u2018\u201c\u201d]/g,'').trim();
    if(!l)return false;
    if(l.replace(/[^a-z]/gi,'').length<2)return false;          // no real letters
    if(/^[\d\s.,:/\u2013\u2014-]+$/.test(l))return false;        // pure number / year / date
    const words=l.split(/\s+/);
    const temporal=w=>this.MONTHS.has(w)||this.DOW.has(w)||this.TEMPORAL.has(w)||/^\d{1,4}(st|nd|rd|th)?s?$/.test(w)||/^(19|20)\d{2}$/.test(w);
    if(words.every(temporal))return false;                       // "march", "25 march 2022", "last week"
    if(words.length===1&&this.STOP.has(l))return false;          // lone stopword
    return true;
  }
  showable(id){const l=this.labelOf(id);return !this.isURLish(l)&&this.conceptual(l)&&!this.strayCapital(id);}
  // A generic concept ("tourism", "runoff") means something specific ON THIS PAGE. Its
  // qualifier is the page's dominant PROPER-NOUN subject (Great Barrier Reef), which we
  // surface in the title — while the bare concept stays reachable via its Wikipedia link.
  isGenericConcept(id){const cap=this.capIndex();const toks=(this.labelOf(id)||'').toLowerCase().split(/\s+/).filter(Boolean);return toks.length>0&&toks.every(w=>cap.lower.has(w))&&toks.some(w=>w.length>=4);}
  contextAnchor(id,vu){
    // Prefer the page's SUBJECT — the entity whose name the page title carries (the
    // article is ABOUT the Great Barrier Reef, so that's the context, not Queensland).
    const p=vu?this.pageOf(vu):null;
    if(p&&p.title){const tl=p.title.toLowerCase();let best=null,bl=0;
      for(const e of this.graph.entities.values()){
        if(e.id===id||!this.showable(e.id))continue;
        const l=this.labelOf(e.id);if(!l||l.length<4)continue;
        if(tl.indexOf(l.toLowerCase())>=0&&l.length>bl){bl=l.length;best=e.id;}
      }
      if(best)return best;
    }
    // Fallback: the dominant proper-noun entity actually mentioned on this page.
    const cap=this.capIndex();let best=null,bw=-1;
    for(const e of this.graph.entities.values()){
      if(e.id===id||!this.showable(e.id))continue;
      const toks=(this.labelOf(e.id)||'').toLowerCase().split(/\s+/).filter(Boolean);
      if(!toks.length||toks.every(w=>cap.lower.has(w)))continue;          // skip other generic concepts
      if(vu&&!this.mentionsOf(e.id).some(i=>this.master.sentenceSource[i]===vu))continue;
      const w=this.weightOf(e);if(w>bw){bw=w;best=e.id;}
    }
    return best;
  }
  // A stray sentence-initial capital is the ambiguous part of speech the reading must
  // drop: "Soft" out of "Soft coral atlas of the Great Barrier Reef." The regex
  // admission can't tell it from a name, so we test it the way the embedding pass does
  // — a single token whose capital is POSITIONAL (it only ever opens a sentence) and
  // which also lives in the corpus as a lowercase common word is an adjective, not an
  // entity. Real names ("Thornbank", "Vela") appear mid-sentence or never lowercase.
  capIndex(){
    if(this._capIdx&&this._capIdxRev===this.state.rev)return this._capIdx;
    const lower=new Set(),capMid=new Set();
    const sents=(this.master&&this.master.sentences)||[];
    for(const s of sents){
      const toks=String(s).split(/\s+/); let pos=0;
      for(const raw of toks){
        const w=raw.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g,''); if(!w){pos++;continue;}
        if(/^[a-z][a-z]+$/.test(w))lower.add(w);
        else if(/^[A-Z][a-z]+$/.test(w)&&pos>0)capMid.add(w);
        pos++;
      }
    }
    this._capIdx={lower,capMid};this._capIdxRev=this.state.rev;return this._capIdx;
  }
  strayCapital(id){
    const lab=this.labelOf(id); if(!lab||/\s/.test(lab))return false;            // multiword names stand
    const w=lab.replace(/[^A-Za-z]/g,''); if(!w||!/^[A-Z][a-z]+$/.test(w))return false;
    const {lower,capMid}=this.capIndex();
    if(capMid.has(w))return false;                                              // seen capitalized mid-sentence → a real name
    const lw=w.toLowerCase();
    return lower.has(lw)||this.COMMON_OPENER.has(lw);                            // positional capital of a common word → drop
  }
  weightOf(e){return e?(Math.log(1+(e.sightings||1))+(this.incident.get(e.id)||0)):0;}
  edgesOf(id){return this.graph.edges.filter(e=>(e.from===id||e.to===id)&&e.from!==e.to);}
  mentionsOf(id){const s=new Set();for(const e of this.master.events){if(e.sentIdx==null)continue;const ids=[e.id,e.src,e.tgt,e.from,e.to].filter(Boolean).map(x=>this.graph.representative(x));if(ids.includes(id))s.add(e.sentIdx);}return [...s].sort((a,b)=>a-b);}
  aliasesOf(id){const s=new Set();for(const ev of this.master.events){if(ev.op==='INS'&&ev.id&&ev.label&&this.graph.representative(ev.id)===id)s.add(ev.label);}const e=this.graph.entities.get(id);if(e&&e.label)s.add(e.label);return [...s].filter(a=>!this.isURLish(a));}
  // A true alias is another SURFACE FORM of the same referent — not a distinct entity
  // that merely shares a token. "Nashville Downtown Partnership" is not an alias of
  // "Nashville"; it is a connected entity. Admit only: identical normalized strings,
  // same content-words reordered, or an acronym↔expansion pair.
  trueAlias(lab,a){
    const clean=s=>this.norm(s).toLowerCase().replace(/[.\-'’"()]/g,'');
    const nl=clean(lab).replace(/\s+/g,''),na=clean(a).replace(/\s+/g,'');
    if(!na)return false; if(na===nl)return true;
    const toks=s=>clean(s).split(/\s+/).filter(w=>w&&!this.STOP.has(w));
    const sl=new Set(toks(lab)),sa=new Set(toks(a));
    if(sl.size&&sl.size===sa.size&&[...sl].every(w=>sa.has(w)))return true;
    const initials=s=>this.norm(s).split(/\s+/).filter(w=>/[A-Za-z]/.test(w)).map(w=>w[0].toLowerCase()).join('');
    if(na===initials(lab)||nl===initials(a))return true;
    return false;
  }
  truncLabel(s,n){s=this.norm(s);return s.length>n?s.slice(0,n-1)+'…':s;}
  // The node's neighborhood as a graph: center = the entity, ring = real neighbors
  // (clickable, edge colored by grain) plus co-referent surface forms the merge folded
  // in (dashed facet nodes). This is what 'connections' should be — not alias chips.
  egoGraph(sel,nbrs,facets){
    const h=React.createElement;
    const W=900,H=500,cx=W/2,cy=H/2+2;
    const lab=this.labelOf(sel),hov=this.state.hoverEnt;
    const GRAINC={Ground:'#2f6f9e',Figure:'#b06f2a',Pattern:'#2f7d54'};
    const real=nbrs.filter(n=>n&&n.id!=null).slice(0,12).map(n=>({label:this.labelOf(n.id),id:n.id,
      rel:(n.vias&&n.vias.find(v=>v&&v.length<22))||(n.vias&&n.vias[0])||'related',
      w:Math.max(0.001,n.w||1),grain:n.grain||'Figure',llm:!!n.llm,real:true}));
    const fac=(facets||[]).slice(0,5).map(f=>({label:f,id:null,rel:'also called',w:0.3,grain:null,real:false}));
    const N=Math.max(real.length,1);
    const wmax=Math.max.apply(null,real.map(n=>n.w).concat([1]));
    const rx=Math.min(330,210+N*9), ry=Math.min(182,132+N*5);
    real.forEach((nd,i)=>{const ang=-Math.PI/2+i*(2*Math.PI/N);
      nd._ca=Math.cos(ang);nd._sa=Math.sin(ang);nd._x=cx+nd._ca*rx;nd._y=cy+nd._sa*ry;
      nd._r=Math.max(17,Math.min(31,16+Math.sqrt(nd.w/wmax)*15));});
    fac.forEach((nd,i)=>{const ang=-Math.PI/2+(i+0.5)*(2*Math.PI/Math.max(fac.length,1));
      nd._ca=Math.cos(ang);nd._sa=Math.sin(ang);nd._x=cx+nd._ca*120;nd._y=cy+nd._sa*92;nd._r=12;});
    const ring=[...real,...fac];
    const anyHover=ring.some(n=>n.real&&n.id===hov);
    const cc=this.hashColor(lab);
    const layers=[];
    // soft backdrop guide rings
    layers.push(h('ellipse',{key:'g1',cx,cy,rx,ry,fill:'none',stroke:'#ecebe6',strokeWidth:1}));
    layers.push(h('ellipse',{key:'g2',cx,cy,rx:rx*0.6,ry:ry*0.6,fill:'none',stroke:'#f2f1ec',strokeWidth:1}));
    // curved edges (under nodes)
    ring.forEach((nd,i)=>{const on=nd.real&&nd.id===hov,faded=anyHover&&!on;
      const gc=nd.real?(GRAINC[nd.grain]||GRAINC.Figure):'#c7bca4';
      const dx=nd._x-cx,dy=nd._y-cy,len=Math.hypot(dx,dy)||1,ux=dx/len,uy=dy/len;
      const sx=cx+ux*41,sy=cy+uy*41,ex=nd._x-ux*nd._r,ey=nd._y-uy*nd._r;
      const mx=(sx+ex)/2,my=(sy+ey)/2,off=nd.real?13:7;
      layers.push(h('path',{key:'e'+i,d:'M '+sx+' '+sy+' Q '+(mx-uy*off)+' '+(my+ux*off)+' '+ex+' '+ey,fill:'none',
        stroke:on?'#8a531e':gc,strokeLinecap:'round',
        strokeWidth:on?3.4:(nd.real?1.2+(nd.w/wmax)*2.6:1),
        strokeDasharray:nd.real?'none':'2 5',opacity:faded?0.1:(nd.real?0.5:0.42)}));});
    // nodes + outward labels with white halo for legibility
    ring.forEach((nd,i)=>{const on=nd.real&&nd.id===hov,faded=anyHover&&!on,c=nd.real?this.hashColor(nd.label):'#b3a585';
      const side=nd._ca>0.34?1:(nd._ca<-0.34?-1:0);
      let lx,ly,anchor;
      if(side===1){lx=nd._x+nd._r+10;ly=nd._y;anchor='start';}
      else if(side===-1){lx=nd._x-nd._r-10;ly=nd._y;anchor='end';}
      else {anchor='middle';lx=nd._x;ly=nd._sa>0?nd._y+nd._r+16:nd._y-nd._r-21;}
      const name=this.truncLabel(nd.label,20),rel=nd.real?this.truncLabel(nd.rel,22):'also called';
      const tw=Math.max(name.length,rel.length)*5.9+14,hx=anchor==='start'?lx-6:anchor==='end'?lx-tw+6:lx-tw/2;
      const els=[];
      if(on)els.push(h('circle',{key:'h',cx:nd._x,cy:nd._y,r:nd._r+6,fill:'none',stroke:c,strokeWidth:1.5,opacity:0.4}));
      els.push(h('circle',{key:'cf',cx:nd._x,cy:nd._y,r:nd._r,fill:nd.real?c:'#fbfaf7',opacity:nd.real?0.12:1}));
      els.push(h('circle',{key:'c',cx:nd._x,cy:nd._y,r:nd._r,fill:'none',stroke:nd.real?c:'#beb091',strokeWidth:on?3:(nd.real?2:1.2),strokeDasharray:nd.real?'none':'3 3'}));
      els.push(h('text',{key:'in',x:nd._x,y:nd._y+4,textAnchor:'middle',style:{fontSize:(nd.real?12:10)+'px',fontWeight:'700',fill:nd.real?c:'#9aa1ab',pointerEvents:'none'}},this.initials(nd.label)));
      els.push(h('rect',{key:'lh',x:hx,y:ly-12,width:tw,height:nd.real?30:17,rx:6,fill:'#fff',opacity:faded?0:0.8}));
      els.push(h('text',{key:'ln',x:lx,y:ly,textAnchor:anchor,style:{fontSize:'11.5px',fontWeight:on?'700':'600',fill:nd.real?'#23262b':'#8a8267',pointerEvents:'none'}},name));
      els.push(h('text',{key:'lr',x:lx,y:ly+13,textAnchor:anchor,style:{fontSize:'9.5px',fontStyle:nd.real?'normal':'italic',fill:nd.real?(GRAINC[nd.grain]||'#9aa1ab'):'#9aa1ab',pointerEvents:'none'}},rel));
      layers.push(h('g',{key:'n'+i,style:{cursor:nd.real?'pointer':'default',opacity:faded?0.3:1,transition:'opacity .15s ease'},
        onClick:nd.real?(()=>this.clickEntity(nd.id)):null,
        onMouseEnter:nd.real?(ev=>this.entHover(nd.id,ev)):null,
        onMouseLeave:nd.real?(()=>this.entLeave()):null},els));});
    // center entity on top
    const nm=this.truncLabel(lab,28),nmw=nm.length*7.2+20;
    layers.push(h('g',{key:'center'},[
      h('circle',{key:'cg',cx,cy,r:49,fill:cc,opacity:0.06}),
      h('circle',{key:'crf',cx,cy,r:40,fill:cc,opacity:0.12}),
      h('circle',{key:'cr',cx,cy,r:40,fill:'none',stroke:cc,strokeWidth:2.6}),
      h('text',{key:'ci',x:cx,y:cy+6,textAnchor:'middle',style:{fontSize:'17px',fontWeight:'800',fill:cc,pointerEvents:'none'}},this.initials(lab)),
      h('rect',{key:'cp',x:cx-nmw/2,y:cy+49,width:nmw,height:24,rx:12,fill:cc,opacity:0.1}),
      h('text',{key:'cn',x:cx,y:cy+65,textAnchor:'middle',style:{fontSize:'13px',fontWeight:'700',fill:cc,pointerEvents:'none'}},nm)
    ]));
    // grain legend
    const leg=[['Ground',GRAINC.Ground],['Figure',GRAINC.Figure],['Pattern',GRAINC.Pattern]];
    layers.push(h('g',{key:'legend'},leg.reduce((acc,[t,col],i)=>{const yy=22+i*17;
      acc.push(h('circle',{key:'ld'+i,cx:13,cy:yy-3,r:4,fill:col}));
      acc.push(h('text',{key:'lt'+i,x:23,y:yy,style:{fontSize:'10px',fontWeight:'600',fill:'#7a8089'}},t));return acc;},[])));
    return h('svg',{viewBox:'0 0 '+W+' '+H,preserveAspectRatio:'xMidYMid meet',style:{display:'block',width:'100%',height:'auto',maxHeight:'54vh'}},layers);
  }
  // Compact neighbourhood "web" for the side panel — same grammar as egoGraph
  // (grain-coloured edges, dashed=facet, click to pivot) but tuned for ~300px.
  egoGraphMini(sel,nbrs){
    const h=React.createElement;
    const W=300,H=232,cx=W/2,cy=H/2;
    const lab=this.labelOf(sel),hov=this.state.hoverEnt;
    const GRAINC={Ground:'#2f6f9e',Figure:'#b06f2a',Pattern:'#2f7d54'};
    const real=(nbrs||[]).filter(n=>n&&n.id!=null&&!this.isURLish(this.labelOf(n.id))).slice(0,7)
      .map(n=>({label:this.labelOf(n.id),id:n.id,w:Math.max(0.001,n.w||1),grain:n.grain||'Figure'}));
    if(!real.length)return null;
    const N=real.length, wmax=Math.max.apply(null,real.map(n=>n.w).concat([1]));
    const rx=Math.min(116,72+N*7), ry=Math.min(84,50+N*6);
    real.forEach((nd,i)=>{const ang=-Math.PI/2+i*(2*Math.PI/N);
      nd._ca=Math.cos(ang);nd._sa=Math.sin(ang);nd._x=cx+nd._ca*rx;nd._y=cy+nd._sa*ry;
      nd._r=Math.max(13,Math.min(20,12+Math.sqrt(nd.w/wmax)*9));});
    const anyHover=real.some(n=>n.id===hov), cc=this.hashColor(lab), layers=[];
    layers.push(h('ellipse',{key:'g1',cx,cy,rx,ry,fill:'none',stroke:'#ecebe6',strokeWidth:1}));
    real.forEach((nd,i)=>{const on=nd.id===hov,faded=anyHover&&!on,gc=GRAINC[nd.grain]||GRAINC.Figure;
      const dx=nd._x-cx,dy=nd._y-cy,len=Math.hypot(dx,dy)||1,ux=dx/len,uy=dy/len;
      const sx=cx+ux*28,sy=cy+uy*28,ex=nd._x-ux*nd._r,ey=nd._y-uy*nd._r;
      const mx=(sx+ex)/2,my=(sy+ey)/2,off=9;
      layers.push(h('path',{key:'e'+i,d:'M '+sx+' '+sy+' Q '+(mx-uy*off)+' '+(my+ux*off)+' '+ex+' '+ey,fill:'none',
        stroke:on?'#8a531e':gc,strokeLinecap:'round',strokeWidth:on?2.6:(1+(nd.w/wmax)*1.8),opacity:faded?0.12:0.5}));});
    real.forEach((nd,i)=>{const on=nd.id===hov,faded=anyHover&&!on,c=this.hashColor(nd.label);
      const side=nd._ca>0.3?1:(nd._ca<-0.3?-1:0);let lx,ly,anchor;
      if(side===1){lx=nd._x+nd._r+5;ly=nd._y+3;anchor='start';}
      else if(side===-1){lx=nd._x-nd._r-5;ly=nd._y+3;anchor='end';}
      else{anchor='middle';lx=nd._x;ly=nd._sa>0?nd._y+nd._r+11:nd._y-nd._r-6;}
      const name=this.truncLabel(nd.label,12),tw=name.length*5.3+8;
      const hx=anchor==='start'?lx-4:anchor==='end'?lx-tw+4:lx-tw/2;
      const els=[];
      if(on)els.push(h('circle',{key:'h',cx:nd._x,cy:nd._y,r:nd._r+4,fill:'none',stroke:c,strokeWidth:1.4,opacity:0.4}));
      els.push(h('circle',{key:'cf',cx:nd._x,cy:nd._y,r:nd._r,fill:c,opacity:0.12}));
      els.push(h('circle',{key:'c',cx:nd._x,cy:nd._y,r:nd._r,fill:'none',stroke:c,strokeWidth:on?2.4:1.6}));
      els.push(h('text',{key:'in',x:nd._x,y:nd._y+3.5,textAnchor:'middle',style:{fontSize:'10px',fontWeight:'700',fill:c,pointerEvents:'none'}},this.initials(nd.label)));
      els.push(h('rect',{key:'lh',x:hx,y:ly-9,width:tw,height:13,rx:4,fill:'#fff',opacity:faded?0:0.82}));
      els.push(h('text',{key:'ln',x:lx,y:ly,textAnchor:anchor,style:{fontSize:'9.5px',fontWeight:on?'700':'600',fill:'#33373d',pointerEvents:'none'}},name));
      layers.push(h('g',{key:'n'+i,style:{cursor:'pointer',opacity:faded?0.32:1,transition:'opacity .15s ease'},
        onClick:()=>this.clickEntity(nd.id),onMouseEnter:(ev)=>this.panelNodeHover(nd.id,ev),onMouseLeave:()=>this.panelNodeLeave()},els));});
    layers.push(h('g',{key:'center'},[
      h('circle',{key:'cf',cx,cy,r:27,fill:cc,opacity:0.1}),
      h('circle',{key:'cr',cx,cy,r:27,fill:'none',stroke:cc,strokeWidth:2.2}),
      h('text',{key:'ci',x:cx,y:cy+5,textAnchor:'middle',style:{fontSize:'13px',fontWeight:'800',fill:cc,pointerEvents:'none'}},this.initials(lab))
    ]));
    const gz=this.state.gz||{k:1,x:0,y:0};
    const stage=h('g',{key:'stage',transform:'translate('+gz.x+' '+gz.y+') scale('+gz.k+')'},layers);
    return h('svg',{viewBox:'0 0 '+W+' '+H,preserveAspectRatio:'xMidYMid meet',
      onPointerDown:e=>this.gzDown(e),
      ref:el=>{if(el&&!el.__wb){el.__wb=true;el.addEventListener('wheel',this._gzWheel,{passive:false});}},
      style:{display:'block',width:'100%',height:'auto',cursor:this._gzDrag?'grabbing':'grab',touchAction:'none'}},[stage]);
  }
  setLens(l){this.setState({panelLens:l});}
  panelNodeHover(id,ev){clearTimeout(this._pivotT);this._hovEnt=id;const st={hoverEnt:id};const x=(ev&&ev.clientX!=null)?ev.clientX:null,y=(ev&&ev.clientY!=null)?ev.clientY:null;if(x!=null)st.hoverXY={x,y};this.setState(st);if(x!=null)this._startCardWatch(x,y);}
  panelNodeLeave(){this._stopCardWatch();this._hovEnt=null;this.setState({hoverEnt:null});}
  // EO cube: a Lens is a SITE, not an act — Significance × Particular: one reading laid
  // over one whole thing, leaving it whole (it does not segment — that would be SEG, an
  // act). Its grain-siblings in the meaning domain are Atmosphere (Significance ×
  // Condition) and Paradigm (Significance × Regularity). So the entity's interpretive
  // terrain is named by the grain the record reads it at.
  _entityGrain(id){
    const c={Ground:0,Figure:0,Pattern:0};
    for(const e of this.edgesOf(id)){const g=this.edgeGrain(e);if(g&&c[g]!=null)c[g]++;}
    let best='Figure',bv=-1;for(const g of ['Figure','Ground','Pattern'])if(c[g]>bv){bv=c[g];best=g;}
    return bv<=0?'Figure':best;
  }
  // ── the geometric reader: measure the interpretation grain, don't infer it ─────
  // _entityGrain above COUNTS edge grains — a structural proxy. The real eoreader4
  // reading EMBEDS each proposition and scores it against the 27 cell centroids
  // (classify/phasepost.js), committing a band only above a margin floor. We read
  // the Interpretation-domain terrains — Atmosphere (Ground) · Lens (Figure) ·
  // Paradigm (Pattern) — off that measurement. Opt-in: it loads a ~50MB MiniLM the
  // centroids were built in; until warmed (or if it can't load) the structural
  // estimate stands, exactly as the engine holds at no-commit.
  async _ensureClassifier(){
    if(this._clsPromise) return this._clsPromise;
    this._clsPromise=(async()=>{
      try{
        const __res=(typeof window!=='undefined'&&window.__resources)||{};
        const [PP,EM]=await Promise.all([import(__res.eoPhase||'./eo/phasepost.js'),import(__res.eoEmbed||'./eo/embed.js')]);
        const [cellsJson,centJson]=await Promise.all([
          fetch(__res.eoCells||'./eo/phasepost-cells.json').then(r=>r.json()),
          fetch(__res.eoCentroids||'./eo/centroids-27.json').then(r=>r.json())
        ]);
        this._embedder=EM.createMiniLMEmbedder();
        return PP.createPhasepostClassifier({cells:cellsJson.CELLS,centroids:centJson,embedder:this._embedder});
      }catch(e){ this._classifierErr=String((e&&e.message)||e); return null; }
    })();
    return this._clsPromise;
  }
  async measureGrain(id){
    if(this.state.grainMeasuring)return;
    const sp=this._spectralLenses(id);
    let texts=(sp.lenses&&sp.lenses.length)?sp.lenses.map(o=>({k:o.repIdx,t:o.text}))
      :this.subjectSentences(id).slice(0,8).map(i=>({k:i,t:this.master.sentences[i]}));
    if(!texts.length)return;
    const fail=(msg)=>this.setState(s=>({grainMeasuring:null,grainMeasure:{...(s.grainMeasure||{}),[id]:{live:false,error:msg}}}));
    this.setState({grainMeasuring:{id,pct:0,phase:'load'}});
    const cls=await this._ensureClassifier();
    if(!cls){ fail(this._classifierErr||'reader unavailable'); return; }
    try{
      await this._embedder.warm((p)=>{ if(!p)return; const pct=p.progress!=null?Math.round(p.progress):(p.total?Math.round((p.loaded/p.total)*100):null);
        this.setState(s=>(s.grainMeasuring&&s.grainMeasuring.id===id?{grainMeasuring:{id,pct:(pct==null?s.grainMeasuring.pct:pct),phase:'download'}}:null)); });
    }catch(e){ fail('couldn’t load the meaning model'); return; }
    this.setState(s=>(s.grainMeasuring&&s.grainMeasuring.id===id?{grainMeasuring:{id,pct:100,phase:'measure'}}:null));
    const INTERP={Atmosphere:'Ground',Lens:'Figure',Paradigm:'Pattern'};
    const tally={Atmosphere:0,Lens:0,Paradigm:0}; const perLens={};
    for(const {k,t} of texts){
      let pc; try{ pc=await cls.classify(this.clean(t)); }catch(e){ continue; }
      if(!pc||!pc.live){ perLens[k]={live:false}; continue; }
      let best=null;
      for(const band of ['ground','figure','pattern']){ const r=pc[band];
        if(r&&r.cell&&INTERP[r.site]){ tally[r.site]+=r.confidence; if(!best||r.confidence>best.confidence)best=r; } }
      perLens[k]=best?{live:true,terrain:best.site,verb:best.fold_verb||null,tag:best.tag||null,conf:best.confidence}:{live:true,nocommit:true};
    }
    let gt=null,bv=-1; for(const tn of ['Lens','Atmosphere','Paradigm'])if(tally[tn]>bv){bv=tally[tn];gt=tn;}
    const measured=bv>0?{live:true,terrain:gt,grain:INTERP[gt],conf:Math.round(bv*1000)/1000,lenses:perLens}
      :{live:true,nocommit:true,lenses:perLens};
    this.setState(s=>({grainMeasuring:null,grainMeasure:{...(s.grainMeasure||{}),[id]:measured}}));
  }
  // The short take a reading reads INTO the entity — the predicate it lays over it.
  _readingLabel(id,i){
    const lab=this.labelOf(id),s=this.clean(this.master.sentences[i]);
    let pred=s;const at=s.toLowerCase().indexOf(lab.toLowerCase());
    if(at>=0){pred=s.slice(at+lab.length).replace(/^[\s,;:\u2014\-]+/,'');
      pred=pred.replace(/^(is|are|was|were|has|have|had|been|became?|becomes?|remains?|serves?(?:\sas)?|acts?\sas|represents?|provides?|forms?|constitutes?|comprises?|contains?|includes?)\s+/i,'');}
    pred=pred.replace(/^(a|an|the|one|its|their|this|that)\s+/i,'');
    const w=this.norm(pred).split(/\s+/).slice(0,6).join(' ').replace(/[,.;:\u2014-]+$/,'');
    return this.truncLabel(w||this.norm(s),28);
  }
  // ── in-article attribution: WHO, inside a source, is making this claim ─────────
  // Not the publisher (en.wikipedia.org) but the cited voice — "CNN labelled it…",
  // "according to UNESCO", "the Queensland National Trust named it…". Heuristic, but
  // the user needs to see who is actually being quoted, not just where it was read.
  _sayer(text,self){
    const s=this.norm(text||''); if(!s||s.length<12)return null;
    // SAYING verbs only — active attribution. Descriptive/passive-prone verbs (found,
    // predicted, attributed, listed…) are deliberately excluded: "X is predicted to…"
    // is the entity being described, not a source speaking.
    const SAY='said|says|stated|states|reported|reports|noted|notes|argued|argues|claimed|claims|wrote|writes|added|explained|explains|warned|warns|confirmed|announced|announces|told|testified|insists|insisted|contends|contended|maintains|maintained|acknowledged|suggested|suggests|concluded|asserts|asserted|labelled|labeled|labels|named|names|called|calls|credited|describes|described|recalled';
    const BE=/\b(is|are|was|were|be|been|being|has|have|had|gets?|got|becomes?|became)$/i;
    let m;
    m=s.match(/\b[Aa]ccording to\s+((?:[Tt]he\s|[Aa]\s|[Aa]n\s)?[A-Z][\w.'’&-]*(?:\s+(?:of\s|the\s|for\s|at\s|and\s|de\s|van\s|von\s)?[A-Z0-9][\w.'’&-]*){0,5})/);
    if(m){const r=this._trimSayer(m[1],self); if(r)return r;}
    m=s.match(new RegExp('\\b([A-Z][\\w.\'’&-]*(?:\\s+[A-Z][\\w.\'’&-]*){0,5})\\s+who\\s+(?:'+SAY+')\\b'));
    if(m){const r=this._trimSayer(m[1],self); if(r)return r;}
    m=s.match(new RegExp('(?:^|[.;:\\u2014]\\s|,\\s|\\bthat\\s)([A-Z][\\w.\'’&-]*(?:\\s+[A-Za-z.\'’&-]+){0,5}?)\\s+(?:'+SAY+')\\b'));
    if(m&&!BE.test(m[1])){const r=this._trimSayer(m[1],self); if(r)return r;}
    m=s.match(/[,”"\u201d]\s*(?:said|wrote|noted|added|told|reported|argued|according to)\s+((?:[Tt]he\s)?[A-Z][\w.'’&-]*(?:\s+[A-Z][\w.'’&-]*){0,4})/);
    if(m){const r=this._trimSayer(m[1],self); if(r)return r;}
    return null;
  }
  _trimSayer(x,self){if(!x)return null;x=this.norm(x).replace(/^(the|a|an)\s+/i,'').replace(/[,.;:]+$/,'').trim();
    let w=x.split(/\s+/); if(w.length>6){x=w.slice(0,6).join(' ');w=x.split(/\s+/);}
    const low=x.toLowerCase();
    if(self&&low===String(self).toLowerCase())return null;
    if(/^(other|this|these|those|their|its|it|such|many|most|some|several|each|both|one|another|every|all|no|any)\b/i.test(x))return null;
    if(w.length===1&&this.STOP&&this.STOP.has(low))return null;
    if(!/[A-Za-z]/.test(x)||/^(it|this|that|these|those|they|he|she|we|i)$/i.test(x))return null;
    return (x.length>=2&&x.length<=46)?x:null;}
  _refLike(s){return /(archived from|retrieved\b|\bdoi:|\bisbn\b|wayback|\boriginal (on|pdf)|\bpp?\.\s*\d|\bvol\.\s*\d|cite (web|journal|news|book)|\.pdf\b)/i.test(String(s||''));}
  // Candidate readings — what the record says ABOUT the entity (subject-role, defined,
  // and evaluative lines). Each carries a base amplitude: its characterizing force.
  _readingCandidates(id){
    const lab=this.labelOf(id),ll=lab.toLowerCase(),esc=ll.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const pool=new Set();
    this.subjectSentences(id).forEach(i=>pool.add(i));
    (this.master.events||[]).filter(ev=>ev.op==='DEF'&&ev.key==='predicate'&&ev.sentIdx!=null&&this.graph.representative(ev.id)===id).forEach(ev=>pool.add(ev.sentIdx));
    this.mentionsOf(id).filter(i=>this.bandOf(i)==='eva').forEach(i=>pool.add(i));
    const amp=i=>{const s=this.clean(this.master.sentences[i]),low=s.toLowerCase();let v=0.6;
      const at=low.indexOf(ll);if(at>=0&&at<30)v+=0.8;
      if(new RegExp('\\b'+esc+'\\b\\s+(is|are|was|were)\\b').test(low))v+=0.9;
      if(this.bandOf(i)==='eva')v+=0.6; else if(this.bandOf(i)==='def')v+=0.4;
      v+=Math.min(0.8,s.length/240); if(s.length>240)v-=0.6; return Math.max(0.15,v);};
    return [...pool].filter(i=>{const s=this.clean(this.master.sentences[i]);return s&&s.length>=28&&this._proseOk(s)&&!this._refLike(s);})
      .map(i=>({i,s:this.clean(this.master.sentences[i]),a:amp(i),src:this.master.sentenceSource[i],band:this.bandOf(i)}));
  }
  // Symmetric eigendecomposition (cyclic Jacobi) — small N only. Returns eigenvalues
  // and eigenvectors (vectors[j] is the eigenvector for values[j]).
  _jacobiEig(A){
    const n=A.length,a=A.map(r=>r.slice());
    const V=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>i===j?1:0));
    for(let sweep=0;sweep<80;sweep++){
      let off=0;for(let p=0;p<n-1;p++)for(let q=p+1;q<n;q++)off+=a[p][q]*a[p][q];
      if(off<1e-11)break;
      for(let p=0;p<n-1;p++)for(let q=p+1;q<n;q++){
        const apq=a[p][q];if(Math.abs(apq)<1e-13)continue;
        const theta=(a[q][q]-a[p][p])/(2*apq);
        const t=(theta>=0?1:-1)/(Math.abs(theta)+Math.sqrt(theta*theta+1));
        const c=1/Math.sqrt(t*t+1),s=t*c;
        for(let k=0;k<n;k++){const akp=a[k][p],akq=a[k][q];a[k][p]=c*akp-s*akq;a[k][q]=s*akp+c*akq;}
        for(let k=0;k<n;k++){const apk=a[p][k],aqk=a[q][k];a[p][k]=c*apk-s*aqk;a[q][k]=s*apk+c*aqk;}
        for(let k=0;k<n;k++){const vkp=V[k][p],vkq=V[k][q];V[k][p]=c*vkp-s*vkq;V[k][q]=s*vkp+c*vkq;}
      }
    }
    const values=[],vectors=[];
    for(let i=0;i<n;i++)values.push(a[i][i]);
    for(let j=0;j<n;j++){const v=[];for(let k=0;k<n;k++)v.push(V[k][j]);vectors.push(v);}
    return {values,vectors};
  }
  // ── the Born rule, properly ──────────────────────────────────────────────────
  // The article's claims about the entity form a density operator ρ = Σ wₖ|vₖ⟩⟨vₖ|
  // (vₖ = a claim's tf·idf direction, wₖ its salience). The entity's LENSES are ρ's
  // eigenvectors; their Born weights are the eigenvalues — and being eigenvectors they
  // are orthogonal, i.e. maximally meaningfully different by construction (Gleason:
  // Tr(ρP) is the only consistent weight on such a basis). A stance SIGN per claim lets
  // a reading the article both asserts and denies interfere DESTRUCTIVELY — loud but
  // self-cancelling frames lose weight, which variance/PCA cannot represent. The von
  // Neumann entropy S=−Σλlogλ is the NPOV readout: low → one frame dominates (POV),
  // high → a balanced mixture (NPOV). We work in the N×N claim Gram (same spectrum as ρ).
  _spectralLenses(id){
    if(!this._specCache||this._specCache.rev!==this.state.rev)this._specCache={rev:this.state.rev,m:new Map()};
    if(this._specCache.m.has(id))return this._specCache.m.get(id);
    const empty={lenses:[],PR:0,entropy:0,npov:0,n:0};
    let C=this._readingCandidates(id);
    if(C.length<2){this._specCache.m.set(id,empty);return empty;}
    C=C.sort((a,b)=>b.a-a.a).slice(0,64);
    const ll=this.labelOf(id).toLowerCase();
    const stem=w=>w.replace(/ies$/,'y').replace(/s$/,'');
    const tokOf=s=>{const set=new Set();s.toLowerCase().split(/[^a-z0-9]+/).forEach(w=>{if(w.length>=4&&!this.STOP.has(w)&&!ll.includes(w))set.add(stem(w));});return set;};
    const toks=C.map(c=>tokOf(c.s)),N=C.length,df=new Map();
    toks.forEach(set=>set.forEach(w=>df.set(w,(df.get(w)||0)+1)));
    const vecs=C.map((c,k)=>{const m=new Map();let nm=0;toks[k].forEach(w=>{const idf=Math.log((N+1)/((df.get(w)||0)+0.5));m.set(w,idf);nm+=idf*idf;});nm=Math.sqrt(nm)||1;m.forEach((v,w)=>m.set(w,v/nm));return m;});
    const sgn=C.map(c=>/\b(not|never|no longer|isn't|wasn't|aren't|weren't|denie[ds]?|disputed|contrary|rather than|myth|incorrectly|false|fails? to|refut|debunk|unlike)\b/i.test(c.s)?-1:1);
    const w=C.map(c=>Math.max(0.15,c.a));
    const dot=(p,q)=>{const a=vecs[p],b=vecs[q],sm=a.size<b.size?a:b,lg=a.size<b.size?b:a;let d=0;sm.forEach((v,k)=>{if(lg.has(k))d+=v*lg.get(k);});return d;};
    const M=Array.from({length:N},()=>new Array(N).fill(0));
    for(let p=0;p<N;p++)for(let q=p;q<N;q++){const val=p===q?w[p]:sgn[p]*sgn[q]*Math.sqrt(w[p]*w[q])*dot(p,q);M[p][q]=val;M[q][p]=val;}
    const {values,vectors}=this._jacobiEig(M);
    let pairs=values.map((v,i)=>({v,vec:vectors[i]})).filter(o=>o.v>1e-6).sort((a,b)=>b.v-a.v);
    if(!pairs.length){this._specCache.m.set(id,empty);return empty;}
    const trace=pairs.reduce((s,o)=>s+o.v,0)||1;
    pairs.forEach(o=>o.p=o.v/trace);
    const PR=1/(pairs.reduce((s,o)=>s+o.p*o.p,0)||1);
    const S=-pairs.reduce((s,o)=>s+(o.p>0?o.p*Math.log(o.p):0),0);
    const npov=pairs.length>1?S/Math.log(pairs.length):0;
    // How many takes to surface is NOT a knob — it's the participation ratio of the Born
    // weights: the effective number of distinct frames this entity's claims actually spread
    // across. Consensus content collapses to ~1 frame; genuinely contested content opens up.
    const maxL=Math.max(2,Math.min(8,Math.round(PR)));
    const floor=Math.max(0.008,(pairs[0].p||0)*0.05);
    const top=pairs.filter(o=>o.p>=floor).slice(0,maxL+4);
    const lenses=[],seenLab=new Set();
    for(const o of top){
      const load=o.vec.map((coef,k)=>({k,coef,abs:Math.abs(coef)*Math.sqrt(w[k])})).sort((a,b)=>b.abs-a.abs);
      const lead=load[0],leadSign=(o.vec[lead.k]>=0?1:-1);
      const lab2=this._readingLabel(id,C[lead.k].i).toLowerCase();
      if(seenLab.has(lab2))continue; seenLab.add(lab2);
      const members=load.filter(x=>x.abs>=lead.abs*0.45);
      const contested=members.some(x=>(o.vec[x.k]>=0?1:-1)!==leadSign&&x.abs>=lead.abs*0.55);
      const srcs=new Set(members.map(x=>C[x.k].src));
      lenses.push({rank:lenses.length,p:o.p,repIdx:C[lead.k].i,text:C[lead.k].s,band:C[lead.k].band,contested,srcs,memberIdx:members.map(x=>C[x.k].i)});
      if(lenses.length>=maxL)break;
    }
    const res={lenses,PR,entropy:S,npov,n:pairs.length};
    this._specCache.m.set(id,res);return res;
  }
  // ── Lenses — distinct readings the record lays over the thing ────────────────
  // A lens is a Site (Significance × Particular): a specific reading laid over the whole
  // entity, individuated by WHAT IT READS IN — "largest reef system" and "threatened by
  // bleaching" are two lenses on one reef. They are offered only when the readings form
  // a meaningful partition under the Born test; otherwise the thing has one settled
  // reading and there are no competing lenses. Connections live elsewhere (the web =
  // Structure); a lens never segments — it lays a take over the whole.
  lensBlock(id,vu,ctxDef,ctxCites){
    const lab=this.labelOf(id),lens=this.state.panelLens||{t:'whole'};
    const gm=(this.state.grainMeasure||{})[id]||null;
    const gMeasuring=this.state.grainMeasuring&&this.state.grainMeasuring.id===id?this.state.grainMeasuring:null;
    const measuredGrain=(gm&&gm.live&&!gm.nocommit)?gm.grain:null;
    const grain=measuredGrain||this._entityGrain(id);
    // eoreader4 reads an entity's INTERPRETATION at one of three grains (the cube's
    // Significance row, Site face): Ground→Atmosphere (ambient tone over a field),
    // Figure→Lens (a reading laid over one whole thing), Pattern→Paradigm (a
    // frame-of-frames everything filters through). The panel speaks the grain the
    // record actually reads this entity at — not a generic "takes".
    const TERRAIN={
      Figure:{name:'Lens',gloss:'how your sources read this one thing',unit:'lens',units:'lenses',more:'More lenses',
        intro:'Your sources don’t all read '+lab+' the same way. Each chip below is one recurring lens — tap it to read the exact lines behind it; tap “Overview” for the combined picture.'},
      Ground:{name:'Atmosphere',gloss:'the ambient tone your sources read this in',unit:'tone',units:'tones',more:'More tones',
        intro:lab+' reads less as a fixed thing than as a condition your sources move through. Each chip below is one recurring tone — tap it to read the lines that set it; tap “Overview” for the combined air.'},
      Pattern:{name:'Paradigm',gloss:'the frame your sources filter everything through',unit:'framing',units:'framings',more:'More framings',
        intro:'Your sources keep '+lab+' as a frame they read other things through. Each chip below is one recurring framing — tap it to read the lines that cast it; tap “Overview” for the combined frame.'},
    };
    const terrain=TERRAIN[grain]||TERRAIN.Figure;
    const grainTriad=[
      {name:'Atmosphere',active:grain==='Ground',style:'font-size:9.5px;font-weight:700;letter-spacing:.02em;padding:2px 8px;border-radius:999px;white-space:nowrap;border:1px solid '+(grain==='Ground'?'var(--acc)':'var(--line2)')+';background:'+(grain==='Ground'?'var(--accbg)':'transparent')+';color:'+(grain==='Ground'?'var(--acc)':'var(--ink3)')+';'},
      {name:'Lens',active:grain==='Figure',style:'font-size:9.5px;font-weight:700;letter-spacing:.02em;padding:2px 8px;border-radius:999px;white-space:nowrap;border:1px solid '+(grain==='Figure'?'var(--acc)':'var(--line2)')+';background:'+(grain==='Figure'?'var(--accbg)':'transparent')+';color:'+(grain==='Figure'?'var(--acc)':'var(--ink3)')+';'},
      {name:'Paradigm',active:grain==='Pattern',style:'font-size:9.5px;font-weight:700;letter-spacing:.02em;padding:2px 8px;border-radius:999px;white-space:nowrap;border:1px solid '+(grain==='Pattern'?'var(--acc)':'var(--line2)')+';background:'+(grain==='Pattern'?'var(--accbg)':'transparent')+';color:'+(grain==='Pattern'?'var(--acc)':'var(--ink3)')+';'},
    ];
    const dot=(c)=>'width:6px;height:6px;border-radius:50%;flex:0 0 auto;background:'+c+';';
    const chipStyle=(active,fillPct)=>{const bg=active?'var(--accbg)':(fillPct!=null?('linear-gradient(90deg,var(--accbg) '+fillPct+'%,var(--card) '+fillPct+'%)'):'var(--card)');
      return 'display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:600;border-radius:999px;padding:4px 10px;cursor:pointer;white-space:nowrap;border:1px solid '+(active?'var(--acc)':'var(--line2)')+';background:'+bg+';color:'+(active?'var(--acc)':'var(--ink2)')+';';};
    const BANDC={eva:'#1d4ed8',def:'#b45309',held:'#6b7280'};
    const sp=this._spectralLenses(id);
    const hasLenses=sp.lenses.length>=2 && sp.PR>=1.6;
    const wholeActive=lens.t==='whole';
    const chips=[{key:'whole',label:'Overview',title:'The combined picture, before picking one take',active:wholeActive,style:chipStyle(wholeActive),dotStyle:dot(this.curAccent()),onPick:()=>this.setLens(null)}];
    if(hasLenses)sp.lenses.forEach(o=>{const i=o.repIdx,a=lens.t==='take'&&lens.i===i,c=BANDC[o.band]||BANDC.held,fill=Math.round(o.p*100);
      chips.push({key:'t'+i,label:this._readingLabel(id,i),
        title:o.srcs.size+' source'+(o.srcs.size!==1?'s':'')+(o.contested?' · contested':'')+' — \u201C'+o.text.slice(0,90)+'\u2026\u201D',
        active:a,style:chipStyle(a,fill),dotStyle:dot(c),onPick:()=>this.setLens({t:'take',i})});});
    // NPOV gauge — von Neumann entropy of ρ, the interpretive spread
    const np=Math.round(sp.npov*100);
    const npovLabel=sp.npov>=0.8?'Your sources spread evenly across these takes':(sp.npov>=0.55?'A few takes, with one leading':'Mostly one take');
    const dom=sp.lenses[0]?this._readingLabel(id,sp.lenses[0].repIdx):'';
    let framing='the combined picture',kindLabel='combined',reading='',cites=[],takeLabel='',attrib='',rankLabel='',contested=false,weightFill=0;
    let measuredReading='',hasMeasuredReading=false;
    // The voice making the take — ALWAYS resolved. A take demonstrates subjectivity, so
    // it must be FROM somebody: the person/org cited inside the text if there is one,
    // otherwise the publisher itself (the editorial voice that asserted it).
    let voiceName='',voicePre='',voicePost='',voiceInit='',voiceAvStyle='',voiceCited=false,voiceMore='',hasVoice=false;
    if(lens.t==='take'&&hasLenses){const o=sp.lenses.find(x=>x.repIdx===lens.i);
      if(o){framing='read as';takeLabel=this._readingLabel(id,o.repIdx);reading=this.endOnBoundary(o.text,320);
        kindLabel=(o.band==='def'?'stated as fact':(o.band==='eva'?'an assessment':'a passing mention'));
        contested=o.contested;weightFill=Math.round(o.p*100);
        rankLabel=o.rank===0?('most common '+terrain.unit):(o.rank===1?'second most common':('less common '+terrain.unit));
        const _sh=[...o.srcs].map(u=>this.short(u));
        const repHost=this.short(this.master.sentenceSource[o.repIdx])||_sh[0]||'';
        const sayer=this._sayer(o.text,lab);
        if(sayer){voiceName=sayer;voicePre='according to';voicePost='';voiceCited=true;}
        else{voiceName=this.voicePretty(repHost);voicePre='';voicePost=(o.band==='def'?'states':(o.band==='eva'?'judges':'notes'));voiceCited=false;}
        const vc=this.hashColor(voiceCited?voiceName:repHost);
        voiceInit=(this.initials?this.initials(voiceName):voiceName.replace(/^the\s+/i,'').slice(0,2).toUpperCase());
        voiceAvStyle='width:26px;height:26px;flex:0 0 auto;border-radius:50%;background:'+vc+'1f;color:'+vc+';display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;letter-spacing:.01em;';
        hasVoice=!!voiceName;
        // a cited voice still rode in on a publisher; many sources → say so
        if(voiceCited){voiceMore='in '+this.voicePretty(repHost);}
        else if(_sh.length>1){voiceMore='\u00B7 also in '+(_sh.length-1)+' other source'+(_sh.length-1!==1?'s':'');}
        attrib='';
        cites=this.citeChips(o.memberIdx.slice(0,6),{right:true});
        // the geometric reader's measured cell for THIS lens, if it has run
        const ml=gm&&gm.lenses&&gm.lenses[o.repIdx];
        if(ml&&ml.live&&!ml.nocommit){const tArt=(ml.terrain==='Atmosphere'?'an Atmosphere':(ml.terrain==='Paradigm'?'a Paradigm':'a Lens'));measuredReading=(ml.verb||'reads')+' \u2014 measured as '+tArt+(ml.tag?(' \u00B7 '+ml.tag):'');hasMeasuredReading=true;}
        else if(ml&&ml.live&&ml.nocommit){measuredReading='measured \u2014 held below the commit floor';hasMeasuredReading=true;}}
    } else { reading=ctxDef||'';cites=ctxCites||[];attrib='folded from every source'; }
    const measuring=!!gMeasuring;
    const measurePct=gMeasuring?(gMeasuring.pct||0):0;
    const measurePhaseLabel=gMeasuring?(gMeasuring.phase==='download'?('Loading the meaning model \u2014 '+(gMeasuring.pct||0)+'%'):(gMeasuring.phase==='measure'?'Measuring against the 27 cells\u2026':'Waking the reader\u2026')):'';
    const grainMeasured=!!measuredGrain;
    const grainNoCommit=!!(gm&&gm.live&&gm.nocommit);
    const grainError=(gm&&!gm.live)?(gm.error||'unavailable'):'';
    const grainSourceLabel=grainMeasured?'measured':(grainNoCommit?'no-commit':(grainError?'estimate':'estimate'));
    const grainMeasureNote=grainMeasured?('Measured against the 27 cell centroids (MiniLM)'+(gm.conf?(' \u00B7 confidence '+gm.conf):'')):(grainNoCommit?'Measured \u2014 no grain cleared the commit floor; structural estimate stands':(grainError?('Couldn\u2019t measure ('+grainError+') \u2014 structural estimate stands'):'Inferred from edge structure \u2014 not yet measured'));
    return {hasLenses,chips,
      measuring,measurePct,measurePhaseLabel,canMeasure:hasLenses&&!measuring&&!grainMeasured,onMeasure:()=>this.measureGrain(id),
      grainMeasured,grainNoCommit,grainSourceLabel,grainMeasureNote,hasGrainError:!!grainError,
      measuredReading,hasMeasuredReading,
      gaugeFill:np,gaugeMarkerStyle:'position:absolute;top:-3.5px;left:'+np+'%;transform:translateX(-50%);width:11px;height:11px;border-radius:50%;border:2px solid var(--ink2);background:#fff;',
      npovLabel,npovDom:dom,hasDom:sp.npov<0.55&&!!dom,nLenses:sp.lenses.length,
      framing,kindLabel,contested,hasContested:contested,takeLabel,hasTake:!!takeLabel,rankLabel,hasRank:!!rankLabel,
      hasWeightBar:weightFill>0,weightBarStyle:'height:4px;border-radius:2px;background:var(--acc);width:'+Math.max(4,weightFill)+'%;',
      terrainName:terrain.name,terrainGloss:terrain.gloss,terrainIntro:terrain.intro,moreLabel:terrain.more,grainTriad,
      hasReading:!!reading,reading:reading||'',attrib,hasAttrib:!!attrib,
      showCombinedHeader:!!reading&&!hasVoice,
      voiceName,voicePre,voicePost,voiceInit,voiceAvStyle,voiceCited,hasVoicePre:!!voicePre,hasVoicePost:!!voicePost,voiceMore,hasVoiceMore:!!voiceMore,hasVoice,
      voiceRole:voiceCited?'voice quoted in the source':'the source speaking',
      cites,hasCites:!!(cites&&cites.length),empty:!reading,
      emptyNote:'No reading laid over '+lab+' yet \u2014 it has been named, not read.'};
  }
  // Page overview — when a page is loaded the panel orients to the WHOLE page: its
  // gist, the spine graph of its main subject, and the entities it introduces.
  pageOverview(url){
    const p=this.pageOf(url);if(!p)return null;
    const idxs=[];for(let i=0;i<this.master.sentences.length;i++)if(this.master.sentenceSource[i]===url)idxs.push(i);
    const boiler=s=>this._refLike(s)||/^this article\b|please help|needs? (additional|more) citation|citation needed|may be in need of|unreferenced|unsourced|multiple issues|improve this article|add citations|learn how and when/i.test(s);
    const lead=[];for(const i of idxs){const s=this.clean(this.master.sentences[i]);if(this._proseOk(s)&&s.length>=44&&!boiler(s))lead.push({i,s});if(lead.length>=2)break;}
    let gist='',gistIdx=[];if(lead.length){gist=this.endOnBoundary(lead.map(o=>o.s).join(' '),360);gistIdx=lead.map(o=>o.i);}
    const sets=new Map();
    for(const ev of this.master.events){if(ev.sentIdx==null||this.master.sentenceSource[ev.sentIdx]!==url)continue;
      [ev.id,ev.src,ev.tgt,ev.from,ev.to].filter(Boolean).forEach(x=>{const r=this.graph.representative(x);
        if(this.graph.entities.has(r)&&this.showable(r)&&!this.isURLish(this.labelOf(r))){let st=sets.get(r);if(!st){st=new Set();sets.set(r,st);}st.add(ev.sentIdx);}});}
    const ranked=[...sets].map(([eid,st])=>({eid,n:st.size})).sort((a,b)=>b.n-a.n);
    const maxN=ranked.length?ranked[0].n:1;
    const protagonists=ranked.slice(0,8).map(({eid,n})=>{const nl=this.labelOf(eid);
      return {id:eid,name:this.truncLabel(nl,30),av:this.initials(nl),avStyle:this.avatar(nl,28),
        sub:n+' mention'+(n!==1?'s':'')+' here',
        barStyle:'height:3px;border-radius:2px;margin-top:4px;background:'+this.hashColor(nl)+';width:'+Math.max(8,Math.round(n/maxN*100))+'%;',
        onSelect:()=>this.clickEntity(eid),onEnter:ev=>this.entHover(eid,ev),onLeave:()=>this.entLeave()};});
    const topId=ranked.length?ranked[0].eid:null;
    const webViz=topId?this.egoGraphMini(topId,this.neighbors(topId),{}):null;
    const c=this.hashColor(this.short(url)),fmtDate=ts=>{try{return new Date(ts).toLocaleDateString([],{month:'short',day:'numeric'});}catch(e){return '';}};
    return {title:p.title,host:this.short(url),url,when:fmtDate(p.ts),
      av:this.short(url).slice(0,2).toUpperCase(),
      avStyle:'width:34px;height:34px;flex:0 0 auto;border-radius:9px;background:'+c+'1a;color:'+c+';display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;',
      stat:sets.size+' entit'+(sets.size!==1?'ies':'y')+' · '+idxs.length+' proposition'+(idxs.length!==1?'s':''),
      hasGist:!!gist,gist,gistCites:gistIdx.length?this.citeChips(gistIdx,{right:true}):[],hasGistCites:gistIdx.length>0,
      hasWeb:!!webViz,webViz,topLab:topId?this.truncLabel(this.labelOf(topId),26):'',onOpenTop:topId?(()=>this.clickEntity(topId)):(()=>{}),
      protagonists,hasProtagonists:protagonists.length>0,allLabel:'Browse all '+sets.size+' entities',onShowAll:()=>this.showAllEntities()};
  }
  showAllEntities(){this.setState({panelMode:'entities'});}
  showOverview(){this.setState({panelMode:'overview'});}
  sourcesOf(id){return [...new Set(this.mentionsOf(id).map(i=>this.master.sentenceSource[i]).filter(Boolean))];}
  neighbors(id){const agg=new Map();for(const e of this.edgesOf(id)){const o=e.from===id?e.to:e.from;if(this.isURLish(this.labelOf(o))||!this.showable(o))continue;const c=agg.get(o)||{w:0,vias:new Set(),sent:null,grain:null,llm:false};c.w+=((e.weight!=null?e.weight:1)||0)+1e-4;const via=e.relType||e.via||e.kind;if(!this.junkRel(via))c.vias.add(via);if(c.sent==null)c.sent=e.sentIdx;if(!c.grain)c.grain=this.edgeGrain(e);if(this.edgeReader(e)==='svo-llm')c.llm=true;agg.set(o,c);}return [...agg].map(([o,v])=>({id:o,w:v.w,vias:[...v.vias],sent:v.sent,grain:v.grain,llm:v.llm})).sort((a,b)=>b.w-a.w);}
  pageOf(url){return this.master.pages.find(p=>p.url===url);}
  // ── subject-not-mention selection ──────────────────────────────────
  // A profile stitches propositions the entity is the SUBJECT of — what the record
  // says ABOUT it — not every sentence its name turns up in. The graph already records
  // the slot (edge.from = subject), so this reads a role; it does not guess.
  subjectSentences(id){const s=new Set();for(const e of this.graph.edges){if(e.from===id&&e.to!==e.from&&e.sentIdx!=null&&!this.isURLish(this.labelOf(e.to)))s.add(e.sentIdx);}return [...s].sort((a,b)=>a-b);}
  // ── the one written sentence ─────────────────────────────────────
  summaryFallback(texts){ if(!texts||!texts.length)return null; return texts.slice(0,2).map(t=>this.norm(t)).join(' ').slice(0,320); }
  // Strip inline reference markers ([13], [74], [1][2], [citation needed], [a]) from
  // text we DISPLAY — never from the sentence we match/scroll against in the live page.
  stripRefs(s){return this.norm(String(s||'').replace(/\s*\[(?:\d+(?:[\u2013-]\d+)?|citation needed|note \d+|[a-z])\]/gi,'')).replace(/\s+([,.;:!?])/g,'$1');}
  clean(s){return this.stripRefs(this.norm(s));}
  // Reconstruct a definition sentence from the label + an attested predicate.
  glossSentence(lab,pred){pred=this.clean(pred).replace(/[\s.;,]+$/,'');if(!pred)return null;
    if(/^(is|are|was|were|has|have|had|can|could|seen|located|known|composed|made|built|consists?|defined|considered|named|protected|found|home)\b/i.test(pred))return lab+' '+pred+'.';
    if(/^(a|an|the|one|part|home|type|kind|form)\b/i.test(pred))return lab+' is '+pred+'.';
    return lab+' \u2014 '+pred+'.';}
  // Trim to <= max chars but never mid-sentence: keep whole sentences, else cut on a
  // word boundary with an ellipsis. No more "...decreasing their abilit".
  endOnBoundary(s,max){s=this.norm(s);max=max||320;if(s.length<=max)return s;const cut=s.slice(0,max);const m=cut.match(/^[\s\S]*[.!?](?=\s|$)/);if(m&&m[0].length>=Math.min(70,max*0.45))return m[0].trim();return cut.replace(/\s+\S*$/,'').replace(/[\s,;:]+$/,'').trim()+'\u2026';}
  // The strongest attested definition the engine isolated for this entity: a DEF
  // (assert/define) event's predicate. Earliest/cleanest wins — the intro defines.
  bestDef(id,onlyUrl){
    let cands=(this.master.events||[]).filter(ev=>ev.op==='DEF'&&ev.key==='predicate'&&ev.value&&ev.sentIdx!=null&&this.graph.representative(ev.id)===id);
    if(onlyUrl)cands=cands.filter(ev=>this.master.sentenceSource[ev.sentIdx]===onlyUrl);
    cands=cands.filter(ev=>{const v=this.clean(ev.value);return v&&v.length>=8&&v.split(/\s+/).length>=2&&!/[a-z][A-Z].*[a-z][A-Z]/.test(v);});
    if(!cands.length)return null;
    const score=ev=>{const v=this.clean(ev.value).toLowerCase();let s=0;
      if(/^(a|an|the)\b/.test(v))s+=2.2;
      if(/\b(state|system|site|region|city|country|area|park|species|organi[sz]ation|company|river|island|reef|sea|nation|territory|town|lake|mountain|range)\b/.test(v))s+=1;
      if(v.length>150)s-=2.5;if(v.length<14)s-=1;s-=ev.sentIdx*0.02;return s;};
    cands.sort((a,b)=>score(b)-score(a));
    const ev=cands[0];const pred=this.clean(ev.value).split(/(?<=[.!?])\s+/)[0];
    if(!pred||pred.length<8||pred.length>200)return null;
    return {pred,sentIdx:ev.sentIdx};
  }
  // Rank sentences by how well they CHARACTERIZE the entity (definitional shape,
  // subject-early), not merely mention it. Used to pick supporting prose.
  rankCtx(id,idxList){
    const lab=(this.labelOf(id)||'').toLowerCase(),esc=lab.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const score=i=>{const s=this.clean(this.master.sentences[i]),low=s.toLowerCase();let v=0;
      if(esc&&new RegExp('\\b'+esc+'\\b\\s+(is|are|was|were)\\b').test(low))v+=3;
      if(/\b(is|are|was|were)\s+(a|an|the)\b/.test(low))v+=0.6;
      if(/\b(known as|located in|composed of|consists? of|part of|defined as|home to|named|protected by|comprises|refers to)\b/.test(low))v+=1;
      const at=low.indexOf(lab);if(at>=0&&at<26)v+=1;
      v+=Math.min(1.2,s.length/150);if(s.length>230)v-=1.2;return v;};
    return (idxList||[]).filter(i=>this._proseOk(this.clean(this.master.sentences[i]))).map(i=>({i,v:score(i)})).filter(o=>o.v>0).sort((a,b)=>b.v-a.v).map(o=>o.i);
  }
  // Compose the "in context · on this page" reading from STRUCTURED signal:
  // the page's DEF predicate (what it asserts the thing IS), plus the best
  // subject-role sentence — not two random mention sentences near the name.
  composeOnPage(id,vu){
    const lab=this.labelOf(id);
    const def=this.bestDef(id,vu);
    if(def){const g=this.glossSentence(lab,def.pred);
      if(g){let text=g,idx=[def.sentIdx];
        const role=this.rankCtx(id,this.subjectSentences(id).filter(i=>this.master.sentenceSource[i]===vu&&i!==def.sentIdx));
        if(role.length){const sup=this.clean(this.master.sentences[role[0]]);if(sup&&text.length+sup.length<=300){text=text+' '+sup;idx.push(role[0]);}}
        return {text:this.endOnBoundary(text,340),idx,kind:'page'};}}
    const occ2=this.mentionsOf(id).filter(i=>this.master.sentenceSource[i]===vu);
    const r=this.rankCtx(id,occ2);
    if(r.length){let text=this.clean(this.master.sentences[r[0]]),idx=[r[0]];
      if(r[1]!=null){const sup=this.clean(this.master.sentences[r[1]]);if(sup&&text.length+sup.length<=300){text=text+' '+sup;idx.push(r[1]);}}
      return {text:this.endOnBoundary(text,340),idx,kind:'page'};}
    const cand=occ2.map(i=>({i,s:this.clean(this.master.sentences[i])})).filter(o=>o.s&&this._proseOk(o.s)).sort((a,b)=>a.s.length-b.s.length)[0];
    if(cand)return {text:cand.s,idx:[cand.i],kind:'pageMention'};
    return null;
  }
  summarySig(sel){ return sel+'|'+this.subjectSentences(sel).length+'|'+this.sourcesOf(sel).length+'|'+this.state.rev; }
  ensureSummary(sel,attestedTexts){
    return; // Disabled by request: no model-composed prose. The verbatim stitch of attested propositions stands on its own, traced below.
    const sig=this.summarySig(sel),cur=this.state.summaries&&this.state.summaries[sel];
    if(cur&&cur.sig===sig)return; if(this._sumPending===sig)return; if(!attestedTexts||!attestedTexts.length)return;
    if(!(typeof window!=='undefined'&&window.claude&&typeof window.claude.complete==='function'))return; // no model → the stitched fallback stands
    this._sumPending=sig; const name=this.labelOf(sel);
    const prompt='Write a neutral, encyclopedia-style summary of "'+name+'" in ONE sentence, two at most. Use ONLY the facts in the attested statements below — each is drawn verbatim from a source. Do not add, infer, or embellish anything not explicitly present. Name plainly what it is. Output only the summary.\n\nAttested statements:\n- '+attestedTexts.slice(0,8).map(t=>this.norm(t)).join('\n- ');
    Promise.resolve().then(()=>window.claude.complete(prompt)).then(out=>{ this._sumPending=null; const txt=this.norm(String(out||'')).replace(/^["\u201c\u201d]+|["\u201c\u201d]+$/g,''); if(txt)this.setState(s=>({summaries:{...s.summaries,[sel]:{text:txt,sig:sig,model:true}}})); }).catch(()=>{this._sumPending=null;});
  }
  // ── Wikipedia-backed definition, coref-checked against the graph ──────
  // For most entities there is no "attested" sentence to stitch. Rather than
  // fail, pull the encyclopedia summary — but only TRUST it when the article
  // corefers to what the graph already knows about this node (its neighbours
  // and the pages it appeared on). No model required.
  // Only proper-noun-like labels deserve an encyclopedia lookup. A lowercase
  // or sentence-case common phrase ("immigrant neighborhoods", "team lead")
  // is a discourse concept, not a named entity — define it from the source.
  looksProperNoun(label){
    const toks=String(label||'').trim().split(/\s+/).filter(Boolean);if(!toks.length)return false;
    const small=new Set('of the and for in on at to a an or de la van von &'.split(' '));
    let content=0,capped=0;
    for(const t of toks){const w=t.replace(/[^A-Za-z0-9]/g,'');if(!w)continue;if(small.has(w.toLowerCase()))continue;content++;if(/^[A-Z0-9]/.test(w))capped++;}
    if(!content)return false;
    return capped===content&&/[A-Za-z]/.test(label);
  }
  wikiDef(id){return this.state.wikiDefs&&this.state.wikiDefs[id];}
  corefContext(id){
    // Context that proves a referent, graded by specificity. STRONG terms are the
    // entities this one actually shares propositions with — its subjects/objects —
    // plus what the record predicates about it. WEAK terms are the pages it merely
    // turned up on. A confirmed article must sit among the STRONG (subject) context,
    // not just share generic topic vocabulary.
    const strong=new Set(),weak=new Set();
    const stem=w=>w.replace(/ies$/,'y').replace(/(ches|shes|sses|xes)$/,m=>m.slice(0,-2)).replace(/s$/,'');
    const addTo=(set,t)=>String(t||'').toLowerCase().split(/[^a-z0-9]+/).forEach(w=>{if(w.length>=4&&!this.STOP.has(w))set.add(stem(w));});
    this.neighbors(id).slice(0,16).forEach(n=>addTo(strong,this.labelOf(n.id)));
    this.subjectSentences(id).slice(0,10).forEach(i=>addTo(strong,this.master.sentences[i]));
    this.sourcesOf(id).forEach(u=>{const p=this.pageOf(u);if(p)addTo(weak,p.title);});
    // Identifying referents — the SPECIFIC entities the ENGINE already admitted and
    // linked to this node (its neighbours: Nashville, Tennessee, DMC…), minus the node's
    // own name tokens. We don't re-detect names ourselves; we trust the engine's graph.
    // This is what an external text must actually share to be the SAME referent, not
    // just the same topic. Generic words ("council", "corporation") never enter here.
    const proper=new Set(),self=new Set();
    String(this.labelOf(id)||'').toLowerCase().split(/[^a-z0-9]+/).forEach(w=>{if(w)self.add(stem(w));});
    this.neighbors(id).slice(0,24).forEach(n=>{const l=this.labelOf(n.id);if(l&&/[A-Z]/.test(l)&&!this.isURLish(l))l.toLowerCase().split(/[^a-z0-9]+/).forEach(w=>{const st=stem(w);if(w.length>=3&&!this.STOP.has(w)&&!this.isGenericName(st))proper.add(st);});});
    self.forEach(w=>proper.delete(w));
    return {strong,weak,proper,generic:this.isGenericConcept(id)};
  }
  // Proper-noun referents named INSIDE an external text (a Wikipedia extract). Same
  // shape as proper-context, so the two can be intersected to coref-resolve.
  articleNames(text){
    const stem=w=>w.replace(/ies$/,'y').replace(/(ches|shes|sses|xes)$/,m=>m.slice(0,-2)).replace(/s$/,'');
    const set=new Set();(String(text||'').match(/\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]+)*\b/g)||[]).forEach(ph=>ph.toLowerCase().split(/\s+/).forEach(w=>{const s=stem(w);if(s.length>=3&&!this.STOP.has(s)&&!this.isGenericName(s))set.add(s);}));
    return set;
  }
  // Org-type / geographic / calendar filler that is NOT an identifying referent. These
  // collide across unrelated topics (a solar "corporation" vs a security "corporation"),
  // so they must never count as coref corroboration — only true proper names do.
  isGenericName(w){
    if(!this._GEN)this._GEN=new Set('state city cities county counties court courts board council councils department departments division office agency authority commission committee bureau national federal american inc llc ltd co company companies corporation corp management partnership group holdings services service systems system solutions association foundation institute university college school center centre downtown district new north south east west northern southern eastern western street road avenue region area january february march april may june july august september october november december monday tuesday wednesday thursday friday saturday sunday'.split(' '));
    return this._GEN.has(w);
  }
  async _wikiJSON(url){
    // Try the source directly first (fast when the frame allows it). Wikipedia's REST +
    // api.php (origin=*) are CORS-open, but THIS preview frame blocks cross-origin fetch,
    // so on failure we fall back to the very same proxy the reader uses for page fetches.
    try{ const r=await fetch(url,{headers:{accept:'application/json'}}); if(r.ok) return await r.json(); }catch(e){}
    const r2=await fetch(this.PROXY+'/feed?url='+encodeURIComponent(url));
    if(!r2.ok) throw new Error('HTTP '+r2.status);
    const txt=await r2.text();
    try{ return JSON.parse(txt); }catch(e){ throw new Error('non-JSON from proxy'); }
  }
  async _wikiSummary(title){const u='https://en.wikipedia.org/api/rest_v1/page/summary/'+encodeURIComponent(String(title).replace(/ /g,'_'))+'?redirect=true';return this._wikiJSON(u);}
  // First 1–3 sentences of an extract, ABBREVIATION-SAFE. A naive split on ". " shatters
  // "Roe v. Wade, 410 U.S. 113 (1973)…" into "Roe v." / "Wade, 410 U.S." — a meaningless
  // stub ("too minimal"). Split only before a capital/quote, re-merge any piece that ended
  // on an abbreviation (v., U.S., Inc., a lone initial), then fill to a readable length.
  _clipExtract(text,maxChars){
    maxChars=maxChars||300;const t=this.norm(text||'');if(!t)return '';
    const raw=t.split(/(?<=[.!?])\s+(?=["\u201c'A-Z])/);
    const ABBR=/(?:^|[\s(])(?:[A-Za-z]|Mr|Mrs|Ms|Dr|Prof|Gen|Sen|Rep|Gov|Lt|Sgt|Sr|Jr|St|vs|v|etc|Inc|Ltd|Co|Corp|No|pp|al|Ave|Rd|Rev|Hon|Capt|U\.S|U\.K|U\.N|D\.C)\.$/i;
    const parts=[];for(const p of raw){if(parts.length&&ABBR.test(parts[parts.length-1]))parts[parts.length-1]+=' '+p;else parts.push(p);}
    let out='',n=0;for(const p of parts){const next=out?out+' '+p:p;if(out.length>=80&&next.length>maxChars)break;out=next;n++;if(out.length>=maxChars||n>=3)break;}
    return out||parts[0]||t.slice(0,maxChars);
  }
  async wikiBest(label,ctx){
    const cands=[];
    try{const d=await this._wikiSummary(label);if(d&&d.type!=='disambiguation'&&d.extract)cands.push(d);}catch(e){}
    let titles=[];
    try{const s=await this._wikiJSON('https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch='+encodeURIComponent(label)+'&srlimit=4&format=json&origin=*');titles=(s.query&&s.query.search||[]).map(x=>x.title);}catch(e){}
    // Context-augmented retrieval: the entity's attested context words (what it DOES /
    // what's said about it) bias the candidate set toward the right referent — so
    // "Outside" + "published obituary" surfaces the magazine, not the jazz technique.
    const ctxTerms=ctx&&ctx.strong?[...ctx.strong].filter(t=>t&&t.length>=4).slice(0,4).join(' '):'';
    if(ctxTerms){try{const s2=await this._wikiJSON('https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch='+encodeURIComponent(label+' '+ctxTerms)+'&srlimit=3&format=json&origin=*');(s2.query&&s2.query.search||[]).forEach(x=>{if(!titles.includes(x.title))titles.push(x.title);});}catch(e){}}
    for(const t of titles){if(cands.find(c=>c.title===t))continue;try{const j=await this._wikiSummary(t);if(j&&j.type!=='disambiguation'&&j.extract)cands.push(j);}catch(e){}if(cands.length>=6)break;}
    if(!cands.length)return null;
    const ctxg=(ctx&&ctx.strong)?ctx:{strong:(ctx||new Set()),weak:new Set()};
    const hayOf=c=>((c.extract||'')+' '+(c.description||'')+' '+(c.title||'')).toLowerCase();
    const hits=(set,hay)=>{let n=0;set.forEach(t=>{if(t&&hay.indexOf(t)>=0)n++;});return n;};
    const strongHits=c=>hits(ctxg.strong,hayOf(c)),weakHits=c=>hits(ctxg.weak,hayOf(c));
    // REAL COREF: intersect the SPECIFIC referents the article names with the graph's.
    // A shared proper noun beyond the entity's own name (Nashville, Tennessee, DMC…) is
    // real corroboration. Zero shared names against a rich graph — while the article
    // names its OWN specific referents — is DISCONFIRMATION: a different thing that
    // merely shares the label (Louisville Metro Council; Solaren the solar startup;
    // Kevin Walters the rugby player).
    const properG=(ctxg.proper&&ctxg.proper.size)?ctxg.proper:new Set();
    const corefHits=c=>{const a=this.articleNames((c.extract||'')+' '+(c.description||''));let n=0;properG.forEach(t=>{if(a.has(t))n++;});return n;};
    const ctxScore=c=>1.3*strongHits(c)+0.5*weakHits(c)+2.4*Math.min(3,corefHits(c));
    // Ranking blends specific-referent coref with lexical AFFINITY of the title to the
    // label — coverage of the label's content tokens AND agreement on the head noun.
    const score=c=>{const af=this._titleAffinity(label,c.title);
      return ctxScore(c) + 3.0*af.covL*(af.headMatch?1:0.25) + (af.exact?2:0) + ((af.headMatch&&af.headBack)?0.6:0) + (String(c.title||'').toLowerCase()===String(label).toLowerCase()?0.5:0);};
    cands.sort((a,b)=>score(b)-score(a));
    const top=cands[0];
    const extract=this._clipExtract(top.extract,300);
    const af=this._titleAffinity(label,top.title),sh=strongHits(top),wk=weakHits(top),ch=corefHits(top);
    const artN=this.articleNames((top.extract||'')+' '+(top.description||''));
    const isGen=!!ctxg.generic;                           // a generic concept ("reef"): the general article IS the meaning
    const canJudge=properG.size>=3;                       // graph rich enough to coref-check
    const disconfirmed=!isGen&&canJudge&&ch===0&&artN.size>=3; // proper-noun anchors elsewhere
    const lexOK=af.exact||(af.headMatch&&af.covL>=0.6&&af.covT>=0.5)||(af.headMatch&&af.covL>=0.85&&af.covT>=0.55);
    // Confirmation needs CORROBORATION from the entity's attested context — a shared
    // specific referent (proper-noun coref, ch) OR a shared predicate/topic term (sh) —
    // never a bare name match. A generic concept is the exception: its general article
    // IS the meaning. ("Outside" the magazine vs "Outside (jazz)": jazz corroborates
    // neither the referents nor the predicates, so it is refused.)
    const corroborated = ch>=1 || sh>=1;
    // SANITY GUARD against a perfect-spelling collision: an article that names ≥3 of its OWN
    // specific referents while sharing NEITHER a coref nor a topic term with what we've read
    // is a different thing wearing the same letters — "trigger laws" (legal) vs "Trigger Law"
    // (a 1944 Western film). Refuse it even when the title matches exactly, generic or not.
    const articleConflict = artN.size>=3 && ch===0 && sh===0;
    const confirmed = !disconfirmed && !articleConflict && lexOK && (isGen ? (af.exact||af.covL>=0.85) : corroborated);
    return {text:extract,title:top.title,desc:top.description||'',
      url:(top.content_urls&&top.content_urls.desktop&&top.content_urls.desktop.page)||('https://en.wikipedia.org/wiki/'+encodeURIComponent(String(top.title).replace(/ /g,'_'))),
      thumb:(top.thumbnail&&top.thumbnail.source)||null,confirmed:confirmed,score:Math.round(score(top)*100)/100,ctxStrong:sh,coref:ch,disconfirmed:disconfirmed};
  }
  // Token affinity between an entity label and a candidate article title:
  // light-stemmed content-token coverage in both directions + head-noun match.
  // This is what replaces the old substring test — "shouldn't just be a span check."
  _titleAffinity(label,title){
    const stop=new Set('the of and for a an on in to at de la von van el le with by as from'.split(' '));
    const stem=w=>w.replace(/ies$/,'y').replace(/(ches|shes|sses|xes)$/,m=>m.slice(0,-2)).replace(/s$/,'');
    const toks=s=>String(s||'').toLowerCase().replace(/\([^)]*\)/g,' ').split(/[^a-z0-9]+/).filter(w=>w.length>1&&!stop.has(w)).map(stem);
    const L=toks(label),T=toks(title);
    if(!L.length||!T.length)return {covL:0,covT:0,headMatch:false,headBack:false,jaccard:0,exact:false};
    const Ls=new Set(L),Ts=new Set(T);let inter=0;Ls.forEach(w=>{if(Ts.has(w))inter++;});
    const uni=new Set([...Ls,...Ts]).size,headL=L[L.length-1],headT=T[T.length-1];
    return {covL:inter/Ls.size,covT:inter/Ts.size,headMatch:Ts.has(headL),headBack:Ls.has(headT),jaccard:inter/uni,exact:Ls.size===Ts.size&&inter===Ls.size};
  }
  // When there is no attested statement AND no confirmed encyclopedia match,
  // compose a definition from the source sentences we DO have — preferring
  // appositive/defining mentions ("NDP's David Corman — a former commander …").
  // Reject scraped boilerplate so composed definitions read like prose, not
  // navigation cruft ("View 30 PhotosBelongs on List?YesNo…", "#16 in World's…").
  _proseOk(s){
    if(!s)return false; const t=String(s); if(t.length<24)return false;
    if((t.match(/[a-z][A-Z]/g)||[]).length>=2)return false;      // camelCase smash
    if(/[A-Za-z]#\d|\d[A-Za-z]{3,}|[a-z]\?[A-Z]/.test(t))return false; // letter/digit smash
    if(/\b(view\s+\d+\s+photos?|yes\s*no|add to list|belongs on list|sign in|log in|subscribe|cookies?)\b/i.test(t))return false;
    const words=t.trim().split(/\s+/); if(words.length<6)return false;
    if(Math.max.apply(null,words.map(w=>w.length))>28)return false; // long spaceless run
    if(!/[a-z]\s+[a-z]/i.test(t))return false;
    return true;
  }
  sourceGist(id,onlyUrl){
    const lab=this.labelOf(id);if(!lab)return null;const ll=lab.toLowerCase();
    let idx=this.mentionsOf(id);if(onlyUrl)idx=idx.filter(i=>this.master.sentenceSource[i]===onlyUrl);if(!idx.length)return null;
    const score=s=>{const low=s.toLowerCase();const at=low.indexOf(ll);if(at<0)return -1;let v=0;
      const after=s.slice(at+lab.length,at+lab.length+44);
      if(/^\s*[—–-]\s*(an?\s+|the\s+)?(former\s+|the\s+)?[a-z]/i.test(after))v+=3.2;
      if(/^\s*,\s*(an?\s+|the\s+)?(former\s+)?[a-z]/i.test(after))v+=2.4;
      if(new RegExp('\\b'+ll.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b\\s+(is|was|are|were|serves?\\s+as|served\\s+as|leads?|directs?|owns?|founded|heads?|runs?|chairs?)\\b','i').test(s))v+=2.6;
      if(/\b(known as|known professionally as|also called|formerly)\b/i.test(s))v+=1.4;
      if(at<28)v+=1;v+=Math.min(1.6,s.length/150);return v;};
    const ranked=idx.map(i=>({i,s:this.norm(this.master.sentences[i])})).filter(o=>o.s&&o.s.length>20&&this._proseOk(o.s)).map(o=>(o.v=score(o.s),o)).filter(o=>o.v>0).sort((a,b)=>b.v-a.v);
    if(!ranked.length)return null;
    const out=[],seen=new Set();
    for(const o of ranked){const k=o.s.slice(0,46);if(seen.has(k))continue;seen.add(k);out.push(o.s);if(out.length>=2)break;}
    return out.join(' ').slice(0,360);
  }
  // ── one representative sentence (verbatim) for an entity we can't yet
  // define — the closest thing in the record, kept as a quote with its source
  // rather than dressed up as a definition. ────────────────────────────
  repQuote(id){
    const lab=this.labelOf(id);if(!lab)return null;const ll=lab.toLowerCase();
    const idx=this.mentionsOf(id);if(!idx.length)return null;
    const score=s=>{const low=s.toLowerCase();const at=low.indexOf(ll);let v=0;
      if(at>=0){if(at<28)v+=1.4;
        if(new RegExp('\\b'+ll.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b\\s+(is|was|are|were|refers?|means?|serves?|forms?|becomes?|consists?)\\b','i').test(s))v+=2.4;
        if(/\b(known as|also called|defined as|type of|kind of|form of)\b/i.test(s))v+=1.6;}
      v+=Math.min(1.4,s.length/160);if(s.length>200)v-=0.8;return v;};
    const ranked=idx.map(i=>({i,s:this.norm(this.master.sentences[i])})).filter(o=>o.s&&o.s.length>24&&o.s.length<300&&this._proseOk(o.s)).map(o=>(o.v=score(o.s),o)).sort((a,b)=>b.v-a.v);
    if(!ranked.length)return null;
    const i=ranked[0].i,u=this.master.sentenceSource[i],p=this.pageOf(u);
    const fmtDate=ts=>{try{return new Date(ts).toLocaleDateString([],{month:'short',day:'numeric'});}catch(e){return '';}};
    return {text:ranked[0].s,srcId:this.srcId(u),host:this.short(u),when:p?fmtDate(p.ts):'',hasWhen:!!(p&&p.ts),
      jumpUrl:this.tfURL(u,this.master.sentences[i]),onOpen:()=>this.openSource(u),onGo:()=>this._scrollToText(ranked[0].s)};
  }
  // ── citation chips: small numbered markers that sit by a summary and, on
  // hover, reveal the exact source sentence + who + when the fold drew on. ─
  citeChips(idxList,opts){
    opts=opts||{};const hc=this.state.hoverCite,active=this.state.pinSrc||this.state.hoverSrc;
    const fmtDate=ts=>{try{return new Date(ts).toLocaleDateString([],{month:'short',day:'numeric'});}catch(e){return '';}};
    // The tip lived as position:absolute inside the scrolling panel, so the panel's
    // overflow clipped it. Anchor it to the viewport (fixed) at the hovered chip's
    // rect, clamped on-screen, so it can never be cut off by an ancestor.
    const xy=this.state.hoverCiteXY,vw=(typeof window!=='undefined'&&window.innerWidth)||1200,vh=(typeof window!=='undefined'&&window.innerHeight)||800;
    const pos=xy?('position:fixed;left:'+Math.max(8,Math.min(Math.round(xy.x-118),vw-256))+'px;top:'+Math.round(Math.min(xy.y+6,vh-170))+'px;'):('position:absolute;top:23px;'+(opts.right?'right:0;':'left:0;'));
    const tip=pos+'z-index:60;width:248px;background:#1b1f24;color:#e8eaed;border-radius:9px;padding:9px 11px;font-size:11.5px;line-height:1.45;font-weight:400;letter-spacing:0;text-transform:none;box-shadow:0 12px 32px rgba(0,0,0,.34);text-align:left;white-space:normal;';
    return (idxList||[]).slice(0,16).map((i,n)=>{const u=this.master.sentenceSource[i],p=this.pageOf(u),txt=this.stripRefs(this.norm(this.master.sentences[i])),key=i+':'+n,cc=this.hashColor(this.short(u)),who=this._sayer(this.master.sentences[i]);
      return {key,n:n+1,label:this.srcId(u),srcId:this.srcId(u),host:this.short(u),who:who||'',hasWho:!!who,when:p?fmtDate(p.ts):'',hasWhen:!!(p&&p.ts),quote:txt,
        jumpUrl:this.tfURL(u,this.master.sentences[i]),showTip:hc===key,tipStyle:tip,
        onOpen:()=>this.openSource(u),
        onEnter:(ev)=>{const r=ev&&ev.currentTarget&&ev.currentTarget.getBoundingClientRect&&ev.currentTarget.getBoundingClientRect();this.setHover(u);this.setState({hoverCite:key,hoverCiteXY:r?{x:r.left,y:r.bottom}:null});},
        onLeave:()=>{this.setHover(null);this.setState({hoverCite:null});},
        title:'“'+txt.slice(0,200)+(txt.length>200?'…':'')+'” — '+this.srcId(u)+' · '+this.short(u),
        chipStyle:'position:relative;display:inline-flex;align-items:center;justify-content:center;min-width:21px;height:18px;padding:0 5px;border-radius:5px;font-size:9.5px;font-weight:800;letter-spacing:.02em;cursor:pointer;transition:all .12s;border:1px solid '+cc+(active===u?';color:#fff;background:'+cc+';':';color:'+cc+';background:'+cc+'14;')};});
  }
  ensureWiki(id){
    const sig=id+'|'+this.state.rev;const cur=this.wikiDef(id);
    if(cur&&cur.sig===sig)return;
    this._wikiPending=this._wikiPending||new Set();if(this._wikiPending.has(sig))return;this._wikiPending.add(sig);
    const label=this.labelOf(id),ctx=this.corefContext(id);
    // GROUND TRUTH FIRST: if the page hyperlinked this entity to a Wikipedia article,
    // bind to THAT article — no searching, no coref guessing (CNN → /wiki/CNN, never CNN+).
    const directHref=this.linkedWiki(id);
    Promise.resolve().then(()=>directHref?this.wikiFromHref(directHref,label):this.wikiBest(label,ctx)).then(best=>{
      this._wikiPending.delete(sig);
      this.setState(s=>({wikiDefs:{...s.wikiDefs,[id]:best?{...best,sig,id}:{sig,id,none:true}}}));
    }).catch(()=>{this._wikiPending.delete(sig);this.setState(s=>({wikiDefs:{...s.wikiDefs,[id]:{sig,id,none:true}}}));});
  }
  // The page's own hyperlink for this entity (by label or any alias) → the canonical
  // Wikipedia article it points to. The page already resolved the ambiguity for us.
  linkedWiki(id){
    const labels=new Set([this.labelOf(id),...this.aliasesOf(id)].filter(Boolean).map(l=>this.norm(l).toLowerCase()));
    for(const p of (this.master&&this.master.pages||[])){if(!p.wikiLinks)continue;for(const l of labels){if(p.wikiLinks[l])return p.wikiLinks[l];}}
    return null;
  }
  async wikiFromHref(href,label){
    const m=String(href||'').match(/\/wiki\/([^#?]+)/);if(!m)return null;
    const title=decodeURIComponent(m[1]).replace(/_/g,' ');
    try{const d=await this._wikiSummary(title);
      if(d&&d.extract){const extract=this._clipExtract(d.extract,300);
        return {text:extract,title:d.title||title,desc:d.description||'',
          url:(d.content_urls&&d.content_urls.desktop&&d.content_urls.desktop.page)||href,
          thumb:(d.thumbnail&&d.thumbnail.source)||null,confirmed:true,linked:true,score:99,coref:99};}
    }catch(e){}
    return null;
  }
  // ── self-enrichment: don't wait to be asked ───────────────────────────
  scheduleAutoEnrich(id){ clearTimeout(this._autoTimer); this._autoTimer=setTimeout(()=>this.tryAutoEnrich(id),1300); }
  tryAutoEnrich(id){
    if(this.props&&this.props.autoEnrich===false)return; if(!this.E||this._busy)return; if(this.state.selId!==id)return;
    if(!this._autoEnriched)this._autoEnriched=new Set(); if(this._autoEnriched.has(id))return;
    if(this.sourcesOf(id).length>=2)return; // already corroborated
    // ── hard session budget: auto-enrich only runs a set number of times, then stops ──
    const budget=(this.props&&this.props.autoEnrichBudget!=null)?this.props.autoEnrichBudget:3;
    if(this._autoEnrichCount==null)this._autoEnrichCount=0;
    if(this._autoEnrichCount>=budget){
      if(!this._autoBudgetNoted){this._autoBudgetNoted=true;
        this.feedSep('auto-enrich budget reached');
        this.feedLine('done','Stopped enriching on its own after '+budget+' page'+(budget!==1?'s':'')+'. Hit Research to keep going.');}
      this._autoEnriched.add(id); return;
    }
    this._autoEnriched.add(id);this._autoEnrichCount++;
    this.feedSep('self-enrich · '+this.labelOf(id)+' · '+this._autoEnrichCount+'/'+budget);
    this.feedLine('search','Thinly sourced — enriching '+this.labelOf(id)+' without being asked ('+this._autoEnrichCount+' of '+budget+').');
    this.research();
  }
  pageTitle(url){const p=this.pageOf(url);return p?p.title:this.short(url);}
  topEntity(){const es=[...this.graph.entities.values()].filter(e=>this.showable(e.id));es.sort((a,b)=>this.weightOf(b)-this.weightOf(a));return es.length?es[0].id:null;}
  tfURL(url,sentence){const base=(url||'').split('#')[0];const w=this.norm(sentence).split(/\s+/);const enc=s=>encodeURIComponent(s).replace(/-/g,'%2D');const frag=w.length>9?(enc(w.slice(0,5).join(' '))+','+enc(w.slice(-5).join(' '))):enc(this.norm(sentence));return base+'#:~:text='+frag;}
  bandOf(i){const s=this.master.sentences[i]||'';if(/\b(reported|found|shows?|showed|according to|documented|recorded|stated|said|confirmed|revealed|disclosed|testified|filing|records? show|measured|observed)\b/i.test(s))return 'eva';if(/\b(will|shall|must|plan|propose|intend|create|establish|develop|aim|seek|commit|adopt|launch|require|recommend|expand|implement)\b/i.test(s))return 'def';return 'held';}
  frontier(id){const items=[];const e=this.graph.entities.get(id);if(!e)return items;const srcs=this.sourcesOf(id);
    for(const v of this.graph.voids.filter(v=>v.node===id))items.push({kind:'void',score:3.0,label:'Confirm or deny — '+(v.rel?('no '+v.rel):'asserted absence'),query:(this.labelOf(id)+' '+(v.rel||'')).trim()});
    const byRel=new Map();for(const ed of this.edgesOf(id)){const via=ed.relType||ed.via||ed.kind;if(this.junkRel(via))continue;const o=ed.from===id?ed.to:ed.from;if(this.isURLish(this.labelOf(o)))continue;if(!byRel.has(via))byRel.set(via,new Set());byRel.get(via).add(o);}
    for(const [via,tg] of byRel){if(tg.size>1&&/own|chair|lead|address|head|director|operate|manage|approv|fund/i.test(via))items.push({kind:'conflict',score:2.6,label:'Adjudicate — '+via+' → '+[...tg].map(x=>this.labelOf(x)).slice(0,2).join(' vs '),query:this.labelOf(id)+' '+via});}
    const dep=2.4-0.5*Math.max(0,srcs.length-1);if(dep>=1.0)items.push({kind:'deepen',score:dep,label:'Thinly sourced — only '+srcs.length+' source'+(srcs.length!==1?'s':''),query:this.labelOf(id)});
    return items.sort((a,b)=>b.score-a.score).slice(0,6);}

  feedLine(k,t){const e=this._feedEnt!=null?this._feedEnt:null;this.setState(s=>({feed:[...s.feed,{k,t,ent:e}]}));}
  feedSep(t){const e=this._feedEnt!=null?this._feedEnt:null;this.setState(s=>({feed:[...s.feed,{sep:t,ent:e}]}));}
  sleep(ms){return new Promise(r=>setTimeout(r,ms));}
  // ---- location/history: each entry is {t:'web',url} or {t:'ent',id} ----
  _locEq(a,b){return a&&b&&a.t===b.t&&(a.t==='web'?a.url===b.url:a.id===b.id);}
  _pushLoc(loc){let h=(this._hist||[]);let p=(this._hpos==null?-1:this._hpos);if(this._locEq(h[p],loc))return;h=h.slice(0,p+1);h.push(loc);this._hist=h;this._hpos=h.length-1;}
  _applyLoc(loc){if(!loc)return;if(loc.t==='web'){this.setState(s=>({selId:null,viewUrl:loc.url,panelSel:null,hoverSrc:null,pinSrc:null,hoverEnt:null,histRev:(s.histRev||0)+1}));this.loadCenter(loc.url);}else{this.setState(s=>({selId:loc.id,viewUrl:null,panelSel:null,hoverSrc:null,pinSrc:null,hoverEnt:null,histRev:(s.histRev||0)+1}));}}
  selectEntity(id){if(this.state.viewUrl)this._srcUrl=this.state.viewUrl;this._panelStack=[];this._pushLoc({t:'ent',id});this.setState(s=>({selId:id,viewUrl:null,panelSel:null,hoverSrc:null,pinSrc:null,hoverEnt:null,gz:{k:1,x:0,y:0},histRev:(s.histRev||0)+1}));}
  _scrollPanelTop(){requestAnimationFrame(()=>{const a=document.getElementById('eo-panel-scroll');if(a)a.scrollTop=0;});}
  clickEntity(id){if(this._gzMoved)return;const cur=this.state.panelSel;if(cur&&cur!==id)this._panelStack.push(cur);this.setState({panelSel:id,rightOpen:true,panelLens:null,gz:{k:1,x:0,y:0}});this._highlightFirst(id);this._scrollPanelTop();}
  closePanelSel(){this._panelStack=[];this.setState({panelSel:null});}
  panelBack(){if(this._panelStack&&this._panelStack.length){const prev=this._panelStack.pop();this.setState({panelSel:prev,panelLens:null,gz:{k:1,x:0,y:0}});if(this._highlightFirst)this._highlightFirst(prev);this._scrollPanelTop();}else this.closePanelSel();}
  // ── source toggles: mute a source so it stops feeding the record, re-project live ──
  muteSrc(url){if(this._muted.has(url))this._muted.delete(url);else this._muted.add(url);try{localStorage.setItem('eo_muted',JSON.stringify([...this._muted]));}catch(e){}this.rebuild(this.state.pages);this.setState(s=>({rev:s.rev+1}));}
  // The sources a given entity's profile is actually drawing on, plus any muted globally
  // (so they can be brought back). Each carries the count of lines it contributes here.
  sourcePanel(id){
    const mentions=this.mentionsOf(id);
    const active=this.sourcesOf(id).map(u=>{const p=this.pageOf(u),c=this.hashColor(this.short(u));
      const lines=mentions.filter(i=>this.master.sentenceSource[i]===u).length;
      return {url:u,host:this.short(u),title:p?this.truncLabel(p.title,44):this.short(u),srcId:this.srcId(u),
        lineLabel:lines+' line'+(lines!==1?'s':''),learned:!!(p&&p.via==='REAFFERENCE'),
        dotStyle:'width:24px;height:24px;flex:0 0 auto;border-radius:7px;background:'+c+'1a;color:'+c+';display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;cursor:pointer;',
        toggleStyle:'flex:0 0 auto;width:30px;height:17px;border-radius:9px;padding:2px;cursor:pointer;background:var(--acc);display:flex;justify-content:flex-end;align-items:center;',
        knobStyle:'width:13px;height:13px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);',
        onMute:()=>this.muteSrc(u),onOpen:()=>this.goWeb(u)};});
    const hidden=this.state.pages.filter(p=>this._muted.has(p.url)).map(p=>({url:p.url,host:this.short(p.url),title:this.truncLabel(p.title,44),onRestore:()=>this.muteSrc(p.url)}));
    return {active,hasActive:active.length>0,count:active.length,hidden,hasHidden:hidden.length>0,hiddenCount:hidden.length};
  }
  // ── graph pan/zoom (the "web") ──────────────────────────────────────────────
  gzReset(){this.setState({gz:{k:1,x:0,y:0}});}
  gzZoom(factor,px,py){this.setState(s=>{const g=s.gz||{k:1,x:0,y:0};const k=Math.max(0.6,Math.min(4,g.k*factor));const cx=(px==null?150:px),cy=(py==null?116:py);const r=k/g.k;return {gz:{k,x:cx-(cx-g.x)*r,y:cy-(cy-g.y)*r}};});}
  _gzWheel=(e)=>{
    // Don't hijack the page's scroll — zoom only when the user deliberately holds ⌘/Ctrl.
    // A plain scroll over the graph just scrolls the panel like everything else.
    if(!(e.ctrlKey||e.metaKey))return;
    e.preventDefault();const svg=e.currentTarget;const r=svg.getBoundingClientRect();if(!r.width)return;
    const vx=(e.clientX-r.left)/r.width*300,vy=(e.clientY-r.top)/r.height*232;
    this.gzZoom(e.deltaY<0?1.1:1/1.1,vx,vy);};
  // Pan via window listeners — NOT pointer capture. Capturing the pointer on the <svg>
  // stole the gesture from the node <g>, so clicking a node never fired its onClick.
  gzDown(e){if(e.button&&e.button!==0)return;const sx=e.clientX,sy=e.clientY,ox=(this.state.gz||{}).x||0,oy=(this.state.gz||{}).y||0,w=(e.currentTarget.getBoundingClientRect().width)||300;this._gzMoved=false;
    const move=(ev)=>{const dx=ev.clientX-sx,dy=ev.clientY-sy;
      // Ignore tiny movement so a click on a node isn't swallowed as a pan, and the
      // graph never nudges from hand-jitter. Only start panning past a real drag.
      if(!this._gzMoved&&Math.abs(dx)+Math.abs(dy)<=7)return;this._gzMoved=true;
      const sc=300/w;this.setState(s=>({gz:{...(s.gz||{k:1,x:0,y:0}),x:ox+dx*sc,y:oy+dy*sc}}));};
    const up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);this._gzDrag=false;this.forceUpdate();setTimeout(()=>{this._gzMoved=false;},30);};
    window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);this._gzDrag=true;}
  // ── side-panel drag-to-resize ───────────────────────────────────────────────
  onResizeDown(e){e.preventDefault();const startX=e.clientX,startW=this.state.panelW||380;const grid=document.getElementById('eo-grid');const handle=document.getElementById('eo-resize');let cur=startW;
    const colsFor=(w)=>(this.state.leftOpen?'264px ':'')+'minmax(0,1fr) '+w+'px';
    const move=(ev)=>{let w=startW+(startX-ev.clientX);w=Math.max(300,Math.min(820,Math.round(w)));cur=w;if(grid)grid.style.gridTemplateColumns=colsFor(w);if(handle)handle.style.right=(w-3)+'px';};
    const up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);document.body.style.cursor='';document.body.style.userSelect='';if(cur!==startW)this.setState({panelW:cur});};
    window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);document.body.style.cursor='col-resize';document.body.style.userSelect='none';}
  onResizeReset(){this.setState({panelW:380});}
  toggleSwap(){const v=!this.state.swapped;try{localStorage.setItem('eo_swap',v?'1':'0');}catch(e){}this.setState({swapped:v});}
  // ── memory log: every source read into memory, with totals ────────────────────
  memoryLog(){
    if(!this.master)return {rows:[],hasRows:false,statLine:'',empty:true};
    const fmt=ts=>{try{return new Date(ts).toLocaleDateString([],{month:'short',day:'numeric'});}catch(e){return '';}};
    const rows=this.state.pages.map(p=>{const muted=this._muted.has(p.url),c=this.hashColor(this.short(p.url));
      const lines=muted?0:this.master.sentenceSource.filter(u=>u===p.url).length;
      return {url:p.url,srcId:muted?'—':this.srcId(p.url),title:this.truncLabel(p.title||this.short(p.url),58),host:this.short(p.url),
        lineLabel:(muted?'muted':lines+' line'+(lines!==1?'s':'')),via:(p.via==='REAFFERENCE'?'researched':'opened'),when:fmt(p.ts),muted,
        dot:'width:28px;height:28px;flex:0 0 auto;border-radius:8px;background:'+c+(muted?'12':'1a')+';color:'+c+';display:flex;align-items:center;justify-content:center;font-size:9.5px;font-weight:800;'+(muted?'opacity:.55;':''),
        toggleStyle:'flex:0 0 auto;width:32px;height:18px;border-radius:10px;padding:2px;cursor:pointer;display:flex;align-items:center;background:'+(muted?'#cfd3da':'var(--acc)')+';justify-content:'+(muted?'flex-start':'flex-end')+';',
        knobStyle:'width:14px;height:14px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);',
        onOpen:()=>{this.setState({memOpen:false});this.goWeb(p.url);},onToggle:()=>this.muteSrc(p.url)};});
    const ns=this.master.pages.length,nl=this.master.sentences.length,ne=this.graph?this.graph.entities.size:0;
    return {rows,hasRows:rows.length>0,empty:rows.length===0,
      statLine:ns+' source'+(ns!==1?'s':'')+' · '+nl+' lines · '+ne+' entities'};
  }
  // The actual EO notation logged into memory — the SVO propositions on every bond.
  _safeJson(o){try{return JSON.stringify(o,(k,v)=>v===undefined?null:v,2);}catch(e){return String((e&&e.message)||e);}}
  memoryNotation(){
    if(!this.master||!this.graph)return {rows:[],count:0,shown:0};
    const GRAINC={Ground:'#2f6f9e',Figure:'#b06f2a',Pattern:'#2f7d54'};
    const seen=new Set(),rows=[];
    for(const e of this.graph.edges){
      if(e.from===e.to)continue;
      if(this.isURLish(this.labelOf(e.from))||this.isURLish(this.labelOf(e.to)))continue;
      const t=this.edgeTriple(e),k=t.s+'|'+t.v+'|'+t.o+'|'+(t.sent==null?'':t.sent);
      if(seen.has(k))continue;seen.add(k);
      const i=rows.length,gc=GRAINC[t.grain]||'#6b7280',exp=(this.state.memExpand===i);
      const ev=(e.seq!=null&&this.master.events[e.seq])||null;
      const u=t.sent!=null?this.master.sentenceSource[t.sent]:null;
      rows.push({idx:i,s:t.s,v:(t.neg?'¬':'')+t.v,o:t.o,arrow:(t.irr?'⤏':'→'),src:t.src||'',grain:t.grain,conf:t.conf.toFixed(2),
        expanded:exp,caret:(exp?'▾':'▸'),
        json:exp?this._safeJson({edge:{from:e.from,to:e.to,via:e.via,relType:e.relType,kind:e.kind,op:e.op,seq:e.seq,sentIdx:e.sentIdx,weight:e.weight,grain:e.grain,confidence:e.confidence,polarity:e.polarity,modality:e.modality,reader:e.reader},event:ev,source:u,sentence:t.sent!=null?this.master.sentences[t.sent]:null}):'',
        hasSrc:!!u,onOpenSrc:u?(()=>{this.setState({memOpen:false});this.openSource(u);}):(()=>{}),
        grainStyle:'font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;color:'+gc+';background:'+gc+'18;border-radius:4px;padding:1px 5px;flex:0 0 auto;',
        srcStyle:'font-size:9px;font-weight:800;color:var(--ink3);flex:0 0 auto;min-width:24px;',
        onToggle:()=>this.setState(s=>({memExpand:s.memExpand===i?null:i}))});
    }
    return {rows:rows.slice(0,600),count:rows.length,shown:Math.min(600,rows.length)};
  }
  previewVals(){const p=this.state.previewWiki;if(!p)return null;
    return {title:p.title,loading:!!p.loading&&!p.extract,err:!!p.err,
      extract:p.extract||'',hasExtract:!!(p.extract&&p.extract.length>0),
      desc:p.desc||'',hasDesc:!!p.desc,url:p.url||p.href,
      av:this.initials(p.title),avStyle:this.avatar(p.title,34),
      onClose:()=>this.closePreview(),
      onOpen:()=>{const u=p.url||p.href;this.closePreview();this.goWeb(u);},
      onRead:()=>{const u=p.url||p.href;this.closePreview();this.goWeb(u);}};}
  toggleRight(){this.setState(s=>({rightOpen:!s.rightOpen}));}
  _highlightFirst(id){this._scrollToText(this.labelOf(id));}
  _scrollToText(text){try{const ifr=document.querySelector('iframe[data-eo-center]');const d=ifr&&ifr.contentDocument;if(!d||!d.body||!text)return;
    // Match against whole-block text, not individual text nodes: entity decoration wraps
    // mentions in <span>, splitting a sentence across several text nodes — so a needle that
    // straddles a highlighted name never lives in one node. canon() folds smart quotes,
    // dashes and whitespace so engine-normalized sentences line up with the rendered text.
    const canon=s=>String(s||'').replace(/[\u2018\u2019\u201a\u201b]/g,"'").replace(/[\u201c\u201d\u201e]/g,'"').replace(/[\u2013\u2014\u2012]/g,'-').replace(/\s+/g,' ').trim().toLowerCase();
    const full=canon(text);if(!full)return;
    const leaves=[...d.body.querySelectorAll('p,li,blockquote,h1,h2,h3,h4,h5,h6,dd,dt,td,figcaption,div')].filter(el=>!el.querySelector('p,li,blockquote,h1,h2,h3,h4,h5,h6,figcaption'));
    const find=len=>{const needle=full.slice(0,len);if(needle.length<8)return null;for(const el of leaves){if(canon(el.textContent).indexOf(needle)>=0)return el;}return null;};
    const el=find(80)||find(48)||find(28)||find(16);if(!el)return;
    const de=d.scrollingElement||d.documentElement;de.scrollTop=Math.max(0,el.getBoundingClientRect().top+de.scrollTop-80);
    const prev=el.style.backgroundColor;el.style.transition='background-color .4s';el.style.backgroundColor='rgba(91,52,214,.18)';setTimeout(()=>{el.style.backgroundColor=prev||'';},1400);
  }catch(e){}}
  // ── shared attributive record: every subject proposition as a quote, worn
  // in register grammar (reports / asserts / names), carrying its source and
  // the date read. Used by both the full-page profile and the side panel so
  // the two surfaces say the same thing the same way. ──────────────────
  provData(id){
    const subjIdx=this.subjectSentences(id);
    const REGV={eva:{verb:'reports',fg:'#1d4ed8',bg:'#e8eefc',gl:'\u25A0'},def:{verb:'asserts',fg:'#b45309',bg:'#fbf0db',gl:'\u25C6'},held:{verb:'names',fg:'#6b7280',bg:'#eef0f3',gl:'\u25CB'}};
    const active=this.state.pinSrc||this.state.hoverSrc;
    const fmtDate=ts=>{try{return new Date(ts).toLocaleDateString([],{month:'short',day:'numeric'});}catch(e){return '';}};
    const rows=subjIdx.map(i=>{const b=this.bandOf(i),u=this.master.sentenceSource[i],p=this.pageOf(u),R=REGV[b]||REGV.held,ch=this.chip(u,active===u);const who=this._sayer(this.master.sentences[i],this.labelOf(id));
      return {sortw:b==='eva'?0:(b==='def'?1:2),verb:R.verb,glyph:R.gl,who:who||'',hasWho:!!who,
        whoStyle:'display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;color:var(--ink);background:#fff;border:1px solid var(--line2);border-radius:5px;padding:2px 7px;flex:0 0 auto;',
        regStyle:'display:inline-flex;align-items:center;gap:5px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:'+R.fg+';background:'+R.bg+';border-radius:5px;padding:2px 8px;flex:0 0 auto;',
        srcId:this.srcId(u),host:this.short(u),when:p?fmtDate(p.ts):'',hasWhen:!!(p&&p.ts),
        txt:this.stripRefs(this.norm(this.master.sentences[i])),jumpUrl:this.tfURL(u,this.master.sentences[i]),
        onOpen:()=>this.openSource(u),onEnter:()=>this.setHover(u),onLeave:()=>this.setHover(null),chip:ch,
        rowStyle:'padding:10px 13px;border-top:1px solid var(--line);'+((active&&active!==u)?'opacity:.24;transition:opacity .14s;':'opacity:1;transition:opacity .14s;')};});
    rows.sort((a,b)=>a.sortw-b.sortw);
    const seenB={};subjIdx.forEach(i=>{seenB[this.bandOf(i)]=true;});
    const legend=['eva','def','held'].filter(b=>seenB[b]).map(b=>{const R=REGV[b];return {label:R.verb,glyph:R.gl,
      style:'display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;color:'+R.fg+';'};});
    return {rows,legend,hasLegend:legend.length>0,count:rows.length};
  }
  panelProfile(id,vu){
    const g=this.graph,lab=this.labelOf(id),e=g.entities.get(id),mentions=this.mentionsOf(id),nbrs=this.neighbors(id);
    const _genAnchor=this.isGenericConcept(id)?this.contextAnchor(id,vu):null;
    const occ=mentions.filter(i=>this.master.sentenceSource[i]===vu);
    const subjIdx=this.subjectSentences(id),evaIdx=subjIdx.filter(i=>this.bandOf(i)==='eva'),attested=evaIdx.map(i=>this.master.sentences[i]);
    const occList=occ.slice(0,6).map(i=>{const full=this.norm(this.master.sentences[i]);return {text:this.truncLabel(this.stripRefs(full),150),onGo:()=>this._scrollToText(full)};});
    const occMore=Math.max(0,occ.length-6);
    const wiki=this.wikiDef(id);
    // Three honest modes. DEFINITION: we have attested propositions or a
    // context-confirmed encyclopedia referent — render it as a definition, with
    // citations. QUOTE: no real definition, but a representative passage exists —
    // show it as a quote, attributed, not dressed up. VOID: nothing — name the edge.
    const cachedSum=this.state.summaries&&this.state.summaries[id],sumSig=this.summarySig(id);
    // Two readings, kept distinct. CONTEXT — what the term comes to mean from
    // everything we've read together: stitched from attested propositions, or,
    // failing that, composed from the most defining source sentences (sourceGist).
    // No model required. WIKIPEDIA — the general meaning, confirmed against the graph.
    // In context = grounded in the page you're reading. Compose from on-page
    // sentences first; only fall back to the cross-source reading when the term
    // does not appear on this page at all.
    let ctxDef=null,ctxKind='',ctxIdx=[];
    if(occ.length){const comp=this.composeOnPage(id,vu);if(comp){ctxDef=comp.text;ctxIdx=comp.idx||[];ctxKind=comp.kind;}}
    if(!ctxDef){
      if(attested.length){
        if(cachedSum&&cachedSum.sig===sumSig&&cachedSum.text){ctxDef=cachedSum.text;ctxKind=cachedSum.model?'synth':'stitch';}
        else{ctxDef=this.summaryFallback(attested);ctxKind='stitch';setTimeout(()=>this.ensureSummary(id,attested),0);}
      } else { const gist=this.sourceGist(id); if(gist){ctxDef=gist;ctxKind='gist';} }
    }
    // Cross-source reading: subject-role / defined sentences from sources OTHER than
    // the page in view. This is the channel research actually feeds, so it earns its
    // own block — visible only once you've read beyond the page in front of you.
    let crossDef=null,crossIdx=[],crossSrcN=0;
    {
      const otherSubj=this.subjectSentences(id).filter(i=>this.master.sentenceSource[i]&&this.master.sentenceSource[i]!==vu);
      const otherDef=(this.master.events||[]).filter(ev=>ev.op==='DEF'&&ev.key==='predicate'&&ev.value&&ev.sentIdx!=null&&this.graph.representative(ev.id)===id&&this.master.sentenceSource[ev.sentIdx]&&this.master.sentenceSource[ev.sentIdx]!==vu).map(ev=>ev.sentIdx);
      const pool=[...new Set([...otherDef,...otherSubj])];
      crossSrcN=new Set(pool.map(i=>this.master.sentenceSource[i]).filter(Boolean)).size;
      if(pool.length){
        const cd=this.bestDef(id,null);let lead=null;
        if(cd&&this.master.sentenceSource[cd.sentIdx]!==vu){lead=this.glossSentence(this.labelOf(id),cd.pred);if(lead)crossIdx.push(cd.sentIdx);}
        const r=this.rankCtx(id,otherSubj.filter(i=>!crossIdx.includes(i)));
        if(!lead&&r.length){lead=this.clean(this.master.sentences[r[0]]);crossIdx.push(r[0]);}
        else if(lead&&r.length){const sup=this.clean(this.master.sentences[r[0]]);if(sup&&lead.length+sup.length<=300){lead=lead+' '+sup;crossIdx.push(r[0]);}}
        if(lead)crossDef=this.endOnBoundary(lead,340);
      }
    }
    const hasCross=!!crossDef&&crossSrcN>0;
    const crossCites=hasCross?this.citeChips(crossIdx,{right:true}):[];
    const cites=(ctxKind==='stitch'||ctxKind==='synth')?this.citeChips(evaIdx,{right:true}):((ctxKind==='page'&&ctxIdx.length)?this.citeChips(ctxIdx,{right:true}):[]);
    const wikiText=(wiki&&wiki.confirmed&&wiki.text)?wiki.text:null;
    const wikiUrl=wikiText?wiki.url:null,wikiTitle=wikiText?wiki.title:null;
    if(!wiki&&(this.looksProperNoun(lab)||this.isGenericConcept(id)))this.ensureWiki(id);
    let rep=null; if(!ctxDef&&!wikiText){rep=this.repQuote(id);}
    const ctxLabel=ctxKind==='page'?'From this page':(ctxKind==='pageMention'?'As used on this page — not yet defined':(ctxKind==='synth'?'Synthesized from your sources':(ctxKind==='stitch'?'Stitched from your sources':(ctxKind==='gist'?'Composed from your sources — not yet attested':''))));
    const ctxHeading=(ctxKind==='page'||ctxKind==='pageMention')?"In context · on this page":"In context · what we've learned together";
    const pd=this.provData(id),pOpen=!!this.state.panelProvOpen;
    // Connected entities — the graph already ranks neighbors by bond weight and carries
    // the relation(s) on each edge. Surface the top ones as a pivotable list so the
    // "N links" stat isn't a dead number: every neighbor is one click to its own profile.
    const nbrShown=nbrs.filter(n=>!this.isURLish(this.labelOf(n.id))).slice(0,7);
    const links=nbrShown.map(n=>{const nl=this.labelOf(n.id),rel=(n.vias&&n.vias[0])?this.norm(n.vias[0]):'';
      return {id:n.id,label:this.truncLabel(nl,30),av:this.initials(nl),avStyle:this.avatar(nl,22),
        rel:rel?('— '+this.truncLabel(rel,24)+' →'):'linked',llm:!!n.llm,
        onClick:()=>this.clickEntity(n.id),onEnter:ev=>this.entHover(n.id,ev),onLeave:()=>this.entLeave()};});
    const linksMore=Math.max(0,nbrs.filter(n=>!this.isURLish(this.labelOf(n.id))).length-nbrShown.length);
    const lr=this.state.liveResearch||{},researching=!!(lr.on&&lr.focal===id),justDone=(!lr.on&&lr.focal===id&&lr.phase==='done');
    const researchMsg=researching?(lr.phase==='read'?('Reading '+(lr.host||'a new source')+'…'):('Searching the web for more on '+lab+'…')):(justDone?((lr.addedFocal>0)?('Added '+lr.addedFocal+' new line'+(lr.addedFocal!==1?'s':'')+' about '+lab+(lr.srcFocal>0?(' · +'+lr.srcFocal+' source'+(lr.srcFocal!==1?'s':'')):'')+'.'):('Read '+(lr.added||0)+' lines into memory — but nothing new about '+lab+' yet. The new sources were about something else.')):'');
    const webViz=this.egoGraphMini(id,nbrs);
    const lens=this.lensBlock(id,vu,ctxDef,cites);
    return {name:lab,av:this.initials(lab),avStyle:this.avatar(lab,40),avStyleSm:this.avatar(lab,30),
      webViz:webViz, hasWeb:!!webViz, webMeta:nbrs.filter(n=>!this.isURLish(this.labelOf(n.id))).length+' connected', lens:lens,
      srcList:this.sourcePanel(id),
      gzLabel:Math.round(((this.state.gz&&this.state.gz.k)||1)*100)+'%',
      onGzIn:()=>this.gzZoom(1.25),onGzOut:()=>this.gzZoom(1/1.25),onGzReset:()=>this.gzReset(),
      contextual:!!_genAnchor, contextAnchorLabel:_genAnchor?this.labelOf(_genAnchor):'', onContextAnchor:_genAnchor?(()=>this.clickEntity(_genAnchor)):(()=>{}),
      hasCtx:!!ctxDef, ctxDef:ctxDef||'', ctxHeading:ctxHeading,
      hasCtxLabel:!!ctxLabel, ctxLabel:ctxLabel,
      ctxBadgeStyle:'display:inline-flex;align-items:center;gap:5px;font-size:10.5px;font-weight:600;color:var(--ink3);background:var(--app);border:1px solid var(--line2);border-radius:6px;padding:2px 7px;',
      cites:cites,hasCites:cites.length>0,
      hasCross:hasCross,crossDef:crossDef||'',crossHeading:'In context · across your sources',
      crossLabel:crossSrcN+' other source'+(crossSrcN!==1?'s':''),
      crossCites:crossCites,hasCrossCites:crossCites.length>0,
      hasWikiDef:!!wikiText, wikiText:wikiText||'', wikiUrl:wikiUrl, wikiTitle:wikiTitle,
      isQuote:!!rep, isVoid:!ctxDef&&!wikiText&&!rep,
      rep:rep||{text:'',srcId:'',host:'',when:'',hasWhen:false,jumpUrl:'',onOpen:()=>{},onGo:()=>{}},
      researching:researching,researchMsg:researchMsg,showResearch:researching||justDone,
      prov:pd, provHas:pd.count>0, provEmpty:pd.count===0, provOpenHas:pd.count>0&&pOpen,
      provCaret:pOpen?'\u25BE':'\u25B8', provToggleLabel:pOpen?'hide provenance':'trace provenance',
      onToggleProv:()=>this.setState(s=>({panelProvOpen:!s.panelProvOpen})),
      provIntro:'Each line is a quote — who said it, and when. The meaning above is my fold of these; if it goes past them, they win.',
      provVoid:'I have not read anything that defines \u201C'+lab+'\u201D. It has been named, not described.',
      stat:(e&&e.sightings||mentions.length)+' mentions · '+nbrs.length+' links',
      occCount:occ.length,occ:occList,hasOcc:occList.length>0,occMore:occMore,hasOccMore:occMore>0,
      links:links,hasLinks:links.length>0,linksCount:nbrs.filter(n=>!this.isURLish(this.labelOf(n.id))).length,linksMore:linksMore,hasLinksMore:linksMore>0,
      onOpenFull:()=>this.selectEntity(id),onExpand:()=>this.selectEntity(id),onBack:()=>this.panelBack(),
      backLabel:(this._panelStack&&this._panelStack.length)?'\u2039 Back':'\u2039 Entities',
      backTitle:(this._panelStack&&this._panelStack.length)?('Back to '+this.truncLabel(this.labelOf(this._panelStack[this._panelStack.length-1])||'previous',24)):'Back to the entity list',
      askIdle:!researching&&!this._busy,
      askSub:'I won\u2019t add sources on my own \u2014 choose how to look.',
      onAskBreadth:()=>{this.setState({mode:'breadth'});this.research(id,'breadth');},
      onAskDepth:()=>{this.setState({mode:'depth'});this.research(id,'depth');},
      onAskResearch:()=>{this.research(id,this.state.mode||'breadth');}};
  }
  goWeb(url){url=this.norm(url);if(!/^[a-z]+:/i.test(url))url='https://'+url;this._srcUrl=null;this._pushLoc({t:'web',url});this.setState(s=>({viewUrl:url,selId:null,panelSel:null,panelLens:null,panelMode:'overview',hoverSrc:null,pinSrc:null,hoverEnt:null,activeChat:null,histRev:(s.histRev||0)+1}));this.loadCenter(url);if(this.state.detect)this.processPage(url);}
  processPage(url){if(this._busy)return;if(this.state.pages.find(p=>p.url===url||p.url==='https://'+url))return;this._busy=true;this._feedEnt=null;this.setState({busy:true});this.feedSep('reading a URL');this.readURL(url,'read').then(res=>{if(res)this.feedLine('read','Read “'+res.title+'” · '+res.sentenceCount+' propositions');this._busy=false;this.setState({busy:false});});}
  toggleDetect(){this.setState(s=>({detect:!s.detect}));}
  canBack(){return !!(this._hist&&this._hpos>0);}
  canForward(){return !!(this._hist&&this._hpos<this._hist.length-1);}
  goBack(){if(this.canBack()){this._hpos--;this._applyLoc(this._hist[this._hpos]);}}
  goForward(){if(this.canForward()){this._hpos++;this._applyLoc(this._hist[this._hpos]);}}
  goToHist(i){if(!this._hist||i<0||i>=this._hist.length)return;this._hpos=i;this._applyLoc(this._hist[i]);}
  closeTab(i){if(!this._hist||i<0||i>=this._hist.length)return;this._hist.splice(i,1);if(this._hpos>=i&&this._hpos>0)this._hpos--;if(this._hpos>=this._hist.length)this._hpos=this._hist.length-1;if(this._hpos>=0)this._applyLoc(this._hist[this._hpos]);else this.setState(s=>({selId:null,viewUrl:null,histRev:(s.histRev||0)+1}));}
  newTab(){this.setState(s=>({selId:null,viewUrl:null,histRev:(s.histRev||0)+1}));}
  tabLabel(loc,g){if(loc.t==='web')return /^text:/i.test(loc.url)?((this.pageOf(loc.url)||{}).title||'Text'):this.short(loc.url);return (g&&g.entities&&g.entities.has(loc.id))?this.labelOf(loc.id):'…';}
  buildTabs(g){const h=this._hist||[];if(!h.length)return[];const all=h.map((loc,i)=>{const lab=this.tabLabel(loc,g);const c=this.hashColor(lab);const active=i===this._hpos;const isWeb=loc.t==='web';return {label:lab,i,active,isWeb,dotStyle:'width:8px;height:8px;border-radius:50%;flex:0 0 auto;background:'+(isWeb?'#9aa1ab':c)+';',onClick:()=>this.goToHist(i),onClose:ev=>{if(ev&&ev.stopPropagation)ev.stopPropagation();this.closeTab(i);},tabStyle:'display:flex;align-items:center;gap:7px;max-width:190px;min-width:96px;padding:7px 9px 7px 11px;border-radius:9px 9px 0 0;cursor:pointer;font-size:12px;'+(active?'background:var(--card);color:var(--ink);font-weight:600;box-shadow:0 -1px 3px rgba(0,0,0,.04);':'background:rgba(255,255,255,.4);color:var(--ink2);')};});return all.slice(-6);}
  // ---- live embed of the page shown in the CENTER viewport ----
  // A readable "book" rendering of an imported text source. The author's own
  // paragraphs (blank-line separated) are kept; if the text has no such structure
  // we group sentences into readable paragraphs. Rendered into the SAME sandboxed
  // iframe the web view uses, so decorateFrame() makes every known entity clickable.
  _bookHtml(p){
    const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    let paras=String(p.text||'').split(/\n\s*\n+/).map(s=>this.norm(s)).filter(s=>s.length);
    if(paras.length<=1){
      const sents=(p.sentences||[]).map(s=>this.norm(s)).filter(Boolean);
      paras=[];for(let i=0;i<sents.length;i+=4)paras.push(sents.slice(i,i+4).join(' '));
    }
    const body=paras.map(t=>'<p>'+esc(t)+'</p>').join('\n');
    const a=this.curAccent();
    return '<!doctype html><html><head><meta charset="utf-8"><base target="_blank">'+
      '<style>html,body{margin:0;background:#fff;}'+
      'body{font:18px/1.72 Georgia,"Iowan Old Style","Times New Roman",serif;color:#23272e;}'+
      '.eo-book{max-width:680px;margin:0 auto;padding:56px 30px 140px;}'+
      'h1.eo-title{font:700 30px/1.25 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;letter-spacing:-.01em;color:#14171c;margin:0 0 6px;}'+
      '.eo-byline{font:13px/1.5 -apple-system,BlinkMacSystemFont,sans-serif;color:#9aa1ab;margin:0 0 34px;border-bottom:1px solid #eef0f3;padding-bottom:18px;}'+
      'p{margin:0 0 22px;}p:first-of-type::first-letter{font-size:3.1em;line-height:.86;float:left;padding:6px 10px 0 0;font-weight:700;color:'+a+';font-family:Georgia,serif;}'+
      '</style></head><body><div class="eo-book"><h1 class="eo-title">'+esc(p.title||'Untitled')+'</h1>'+
      '<div class="eo-byline">Imported text · '+((p.sentences||[]).length)+' propositions · read as a book</div>'+
      body+'</div></body></html>';
  }
  loadCenter(url){
    if(/^text:/i.test(url)){const p=this.pageOf(url);this.setState({pageDoc:p?this._bookHtml(p):null,pageLoading:false,pageErr:p?null:'Text not found'});return;}
    if(!url){this.setState({pageDoc:null,pageLoading:false,pageErr:null});return;}
    if(this._pageUrl===url&&this.state.pageDoc)return;
    this._pageUrl=url;this.setState({pageLoading:true,pageDoc:null,pageErr:null});
    fetch(this.PROXY+'/feed?url='+encodeURIComponent(url)).then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.text();}).then(html=>{
      if(this.state.viewUrl!==url)return;
      let doc=html;
      // Neutralize anything that would navigate the frame away (which turns it
      // cross-origin and breaks entity decoration): scripts, no-JS refreshes,
      // meta refreshes. Stray links open in a new tab via <base target>.
      doc=doc.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'')
             .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi,'')
             .replace(/<meta[^>]+http-equiv\s*=\s*["']?refresh["']?[^>]*>/gi,'');
      const baseTag='<base href="'+url+'" target="_blank"><meta name="referrer" content="no-referrer">';
      if(/<head[^>]*>/i.test(doc)) doc=doc.replace(/<head([^>]*)>/i,'<head$1>'+baseTag);
      else if(/<html[^>]*>/i.test(doc)) doc=doc.replace(/<html([^>]*)>/i,'<html$1><head>'+baseTag+'</head>');
      else doc=baseTag+doc;
      this.setState({pageDoc:doc,pageLoading:false});
    }).catch(e=>{ if(this.state.viewUrl===url)this.setState({pageLoading:false,pageErr:String(e&&e.message||e)}); });
  }
  navBtnStyle(on){return 'width:27px;height:27px;flex:0 0 auto;border:1px solid var(--line2);background:var(--app);border-radius:7px;font-size:17px;line-height:1;display:flex;align-items:center;justify-content:center;'+(on?'color:var(--ink2);cursor:pointer;':'color:#cbced4;cursor:default;');}
  entRow(e,sel){
    const fc=this.frontier(e.id).length,isSel=e.id===sel,lab=this.labelOf(e.id);
    return {name:lab,sub:(e.sightings||1)+' mentions · '+this.neighbors(e.id).length+' links',av:this.initials(lab),avStyle:this.avatar(lab,30),
      hasFrontier:fc>0,frontierCount:fc,frontierStyle:'font-size:10.5px;font-weight:700;color:#9a6b12;background:#fbf3df;border:1px solid #ecd9a3;border-radius:11px;min-width:19px;height:19px;display:flex;align-items:center;justify-content:center;padding:0 5px;',
      onSelect:()=>this.clickEntity(e.id),onEnter:ev=>this.entHover(e.id,ev),onLeave:()=>this.entLeave(),rowStyle:'display:flex;align-items:center;gap:11px;padding:10px 14px;border-bottom:1px solid var(--line);cursor:pointer;'+(isSel?'background:var(--accbg);box-shadow:inset 3px 0 0 var(--acc);':'')};
  }
  onSearch(ev){this.setState({query:ev&&ev.target?ev.target.value:''});}
  onDirInput(ev){this.setState({direction:ev&&ev.target?ev.target.value:''});}
  onUrlInput(ev){this.setState({url:ev&&ev.target?ev.target.value:''});}
  onUrlKey(ev){if(ev&&ev.key==='Enter')this.doReadUrl();}
  // A URL (or bare domain) is opened directly; anything else is a Project Gutenberg
  // book search — type a title or author to find a book to read.
  doReadUrl(){const u=this.state.url.trim();if(!u)return;this.setState({url:''});
    if(/^https?:\/\//i.test(u)||/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(\/|$|\?)/i.test(u)){this.goWeb(u);}
    else{this.searchBooks(u);}}
  setHover(s){this.setState({hoverSrc:s});}
  openSource(url,wide,tab){const isText=/^text:/i.test(url);this.setState({openSrc:url,srcTab:tab||(isText?'props':'page'),srcWide:!!wide});this.loadEmbed(url);}
  closeSource(){this._embedUrl=null;this.setState({openSrc:null,srcDoc:null,srcLoading:false,srcErr:null});}
  toggleWide(){this.setState(s=>({srcWide:!s.srcWide}));}
  setSrcTab(t){this.setState({srcTab:t});if(t==='page')this.loadEmbed(this.state.openSrc);}
  // Live embed of the actual page — fetched through the same proxy, rendered in a
  // sandboxed iframe via srcdoc with an injected <base> so its CSS/images resolve.
  // No allow-scripts: frame-busting and trackers can't run; layout/styles still paint.
  loadEmbed(url){
    if(!url||/^text:/i.test(url)){this.setState({srcDoc:null,srcLoading:false,srcErr:null});return;}
    if(this._embedUrl===url&&this.state.srcDoc)return;
    this._embedUrl=url; this.setState({srcLoading:true,srcDoc:null,srcErr:null});
    fetch(this.PROXY+'/feed?url='+encodeURIComponent(url)).then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.text();}).then(html=>{
      if(this.state.openSrc!==url)return;
      let origin=url; try{origin=new URL(url).origin+'/';}catch(e){}
      const baseTag='<base href="'+origin+'"><meta name="referrer" content="no-referrer">';
      let doc=String(html||'');
      if(/<head[^>]*>/i.test(doc)) doc=doc.replace(/<head([^>]*)>/i,'<head$1>'+baseTag);
      else if(/<html[^>]*>/i.test(doc)) doc=doc.replace(/<html([^>]*)>/i,'<html$1><head>'+baseTag+'</head>');
      else doc=baseTag+doc;
      this.setState({srcDoc:doc,srcLoading:false});
    }).catch(e=>{ if(this.state.openSrc===url)this.setState({srcLoading:false,srcErr:String(e&&e.message||e)}); });
  }
  // ── interconnect: link every known entity inside the source text, wiki-style ──
  toggleLinkMode(){try{localStorage.setItem('eo_linkmode',this.state.linkMode?'0':'1');}catch(e){}this.setState(s=>({linkMode:!s.linkMode}));}
  buildLinkIndex(){
    if(this._linkRe!==undefined&&this._linkRev===this.state.rev)return this._linkMap;
    const map=new Map(),labels=[];
    if(this.graph){for(const e of this.graph.entities.values()){
      if(!this.showable(e.id))continue;const l=this.labelOf(e.id);if(!l||l.length<3)continue;
      const lc=l.toLowerCase();if(this.STOP.has(lc))continue;if(!map.has(lc)){map.set(lc,e.id);labels.push(l);}}}
    labels.sort((a,b)=>b.length-a.length);
    const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const pat=labels.slice(0,500).map(esc).join('|');
    this._linkRe=pat?new RegExp('\\b('+pat+')\\b','gi'):null;
    this._linkMap=map;this._linkRev=this.state.rev;return map;
  }
  linkifyNode(text,srcUrl){
    if(!this.state.linkMode)return text;
    if(!this._lnCache||this._lnRev!==this.state.rev||this._lnMode!==this.state.linkMode){this._lnCache=new Map();this._lnRev=this.state.rev;this._lnMode=this.state.linkMode;}
    const key=(srcUrl||'')+'\u0001'+text;
    if(this._lnCache.has(key))return this._lnCache.get(key);
    const node=this._linkify(text,srcUrl);this._lnCache.set(key,node);return node;
  }
  _linkify(text,srcUrl){
    const map=this.buildLinkIndex(),re=this._linkRe;if(!re)return text;
    const cur=this.state.selId;re.lastIndex=0;
    const out=[];let last=0,m,k=0,n=0,seen=new Set();
    while((m=re.exec(text))&&n<80){n++;
      const id=map.get(m[0].toLowerCase());
      if(id==null||id===cur||seen.has(id))continue; seen.add(id);
      if(m.index>last)out.push(text.slice(last,m.index));
      out.push(React.createElement('span',{key:'lk'+(k++),
        style:{color:'var(--acc)',cursor:'pointer',borderBottom:'1px dotted var(--accline)'},
        onMouseEnter:ev=>this.entHover(id,ev),onMouseMove:ev=>this.entHover(id,ev),onMouseLeave:()=>this.entLeave(),
        onClick:ev=>{if(ev){ev.stopPropagation();ev.preventDefault();}this.openLinkChoice(id,srcUrl,ev);}},m[0]));
      last=m.index+m[0].length;
    }
    if(!out.length)return text;
    if(last<text.length)out.push(text.slice(last));
    return React.createElement('span',null,out);
  }
  openLinkChoice(id,srcUrl,ev){const x=(ev&&ev.clientX)||0,y=(ev&&ev.clientY)||0;this.entLeave();this.setState({linkChoice:{id,srcUrl,x,y}});}
  closeLinkChoice(){this.setState({linkChoice:null});}
  linkChoiceVals(base){const g=this.graph;if(!(this.state.linkChoice&&g&&g.entities.has(this.state.linkChoice.id)))return;
    const lc=this.state.linkChoice,lid=lc.id,llab=this.labelOf(lid);
    const vw=(typeof window!=='undefined'&&window.innerWidth)||960,lx=Math.min(Math.max(8,lc.x),vw-252),ly=lc.y+12;
    base.linkChoiceOn=true;base.linkChoice={label:llab,host:this.short(lc.srcUrl||''),av:this.initials(llab),avStyle:this.avatar(llab,30),hasSource:!!lc.srcUrl,
      wrap:'position:fixed;left:'+lx+'px;top:'+ly+'px;width:244px;background:var(--card);border:1px solid var(--line);border-radius:12px;box-shadow:0 14px 38px rgba(20,24,30,.22);padding:7px;z-index:42;animation:eopop .12s ease-out;',
      onProfile:()=>{this.closeLinkChoice();this.closeSource();this.clickEntity(lid);},
      onSource:()=>{this.closeLinkChoice();const u=lc.srcUrl;if(u){try{this.goWeb(u);}catch(e){}}}};}
  // ---- content-script: decorate the live page in the center iframe ----
  componentDidUpdate(prevProps,prevState){
    // Navigating to a different entity resets the panel to the top — you land on the
    // new entity's identity, not wherever you'd scrolled the previous one. (The runtime
    // doesn't pass prevState reliably, so track the last selection on the instance.)
    if(this.state.panelSel!==this._lastPanelSel){this._lastPanelSel=this.state.panelSel;if(this.state.panelSel){const a=document.getElementById('eo-panel-scroll');if(a)a.scrollTop=0;const b=document.getElementById('eo-panel-body');if(b){b.style.animation='none';void b.offsetWidth;b.style.animation='eoswap .26s ease-out';}}}
    if(this.state.viewUrl&&this.state.pageDoc){
      const token=this.state.viewUrl+'|'+this.state.rev+'|'+(this.state.linkMode?1:0)+'|'+this.curAccent()+'|'+this.state.highlightStyle;
      if(token!==this._decoToken){this._decoToken=token;this._scheduleDecorate();}
    } else {this._decoToken=null;}
  }
  _scheduleDecorate(){clearTimeout(this._decoT);let tries=0;const tick=()=>{const ifr=document.querySelector('iframe[data-eo-center]');const d=ifr&&ifr.contentDocument;if(d&&d.body&&d.body.childNodes.length){this.decorateFrame(d,ifr);}else if(tries++<50){this._decoT=setTimeout(tick,80);}};this._decoT=setTimeout(tick,60);}
  _frameOffset(){const ifr=document.querySelector('iframe[data-eo-center]');if(!ifr)return{x:0,y:0};const r=ifr.getBoundingClientRect();return{x:r.left,y:r.top};}
  decorateFrame(d,ifr){
    try{
      // styles — rebuilt each pass so accent + highlight mode apply live
      {let st=d.getElementById('__eo_style');if(!st){st=d.createElement('style');st.id='__eo_style';(d.head||d.body).appendChild(st);}
        const a=this.curAccent(),hl=this.state.highlightStyle;
        const base='cursor:pointer;border-radius:2px;transition:background .12s;';
        let ent,entH,lnk,lnkH;
        if(hl==='marker'){ent=base+'border-bottom:1.5px solid '+this.hexA(a,.45)+';background:'+this.hexA(a,.07)+';';entH='background:'+this.hexA(a,.18)+';';lnk=base+'background:'+this.hexA(a,.07)+';box-shadow:inset 0 -1.5px 0 '+this.hexA(a,.45)+';';lnkH='background:'+this.hexA(a,.18)+';';}
        else if(hl==='underline'){ent=base+'border-bottom:1.5px solid '+this.hexA(a,.5)+';';entH='background:'+this.hexA(a,.12)+';';lnk=base+'border-bottom:1.5px dotted '+this.hexA(a,.6)+';';lnkH='background:'+this.hexA(a,.12)+';';}
        else{ent=base;entH='background:'+this.hexA(a,.16)+';';lnk=base;lnkH='background:'+this.hexA(a,.16)+';';}
        st.textContent='.eo-ent{'+ent+'}.eo-ent:hover{'+entH+'}.eo-ent-link{'+lnk+'}.eo-ent-link:hover{'+lnkH+'}.eo-ent-link::after{content:"\\25C9";font-size:.62em;color:'+a+';vertical-align:super;margin-left:1px;opacity:'+(hl==='off'?'.55':'.8')+';}';}
      // unbind/strip if linkMode off
      if(!this.state.linkMode){d.querySelectorAll('[data-eo-ent]').forEach(s=>{const t=d.createTextNode(s.textContent);s.parentNode.replaceChild(t,s);});d.querySelectorAll('a[data-eo-wiki]').forEach(a=>{a.classList.remove('eo-ent-link');a.removeAttribute('data-eo-wiki');});return;}
      const map=this.buildLinkIndex(),re=this._linkRe;if(!re)return;
      this._frameIds=this._frameIds||[];
      const walker=d.createTreeWalker(d.body,NodeFilter.SHOW_TEXT,{acceptNode:n=>{
        if(!n.nodeValue||!n.nodeValue.trim()||n.nodeValue.length<3)return NodeFilter.FILTER_REJECT;
        const p=n.parentElement;if(!p)return NodeFilter.FILTER_REJECT;
        const tag=p.tagName;if(tag==='SCRIPT'||tag==='STYLE'||tag==='NOSCRIPT'||tag==='TEXTAREA'||tag==='CODE'||tag==='PRE')return NodeFilter.FILTER_REJECT;
        if(p.closest('[data-eo-ent]'))return NodeFilter.FILTER_REJECT;
        // Don't sub-wrap entities INSIDE a real hyperlink — the whole anchor is one span.
        // Otherwise "Proceedings of the National Academy of Sciences" fragments into
        // "National Academy" + "Sciences" dots. The whole-anchor pass below handles it.
        if(p.closest('a'))return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;}});
      const targets=[];let nn,cap=0;while((nn=walker.nextNode())&&cap<4000){targets.push(nn);cap++;}
      let wraps=0;
      for(const node of targets){
        if(wraps>1500)break;const text=node.nodeValue;re.lastIndex=0;let m,last=0,frags=null;
        const aEl=node.parentElement&&node.parentElement.closest?node.parentElement.closest('a'):null;
        const href=(aEl&&aEl.getAttribute&&aEl.getAttribute('href'))?aEl.href:null;
        while((m=re.exec(text))){
          const id=map.get(m[0].toLowerCase());if(id==null)continue;
          frags=frags||[];if(m.index>last)frags.push(d.createTextNode(text.slice(last,m.index)));
          const span=d.createElement('span');const idx=this._frameIds.push(id)-1;
          span.setAttribute('data-eo-ent',String(idx));span.className=href?'eo-ent-link':'eo-ent';
          if(href)span.setAttribute('data-eo-href',href);
          span.textContent=m[0];frags.push(span);last=m.index+m[0].length;wraps++;
          if(wraps>1500)break;
        }
        if(frags){if(last<text.length)frags.push(d.createTextNode(text.slice(last)));const par=node.parentNode;frags.forEach(f=>par.insertBefore(f,node));par.removeChild(node);}
      }
      // Every real in-article link is an explorable thing, not only the ones already
      // folded into the graph. Graph entities inside a link are wrapped above; give
      // the dot + click affordance to the remaining content anchors too.
      try{d.querySelectorAll('a[href]').forEach(a=>{
        if(a.querySelector('[data-eo-ent]'))return;
        if(a.closest('sup,.reference,.mw-editsection,.mw-cite-backlink,.noprint,[role="navigation"]'))return;
        const href=a.getAttribute('href')||'';if(!href||href[0]==='#'||/^javascript:/i.test(href))return;
        if(a.querySelector('img'))return;
        const txt=(a.textContent||'').trim();
        if(txt.length<2||txt.length>90||/^\[?\d+\]?$/.test(txt))return;
        // Bind a profile only when the WHOLE anchor text is itself a graph entity —
        // never a fragment inside it. "Proceedings of the National Academy of Sciences"
        // must not pivot to the "National Academy" fragment (wrong content); it stays a
        // navigate-only wiki link pointing at its own article.
        const id=map.get(txt.toLowerCase());
        a.classList.add('eo-ent-link');a.setAttribute('data-eo-wiki','1');a.setAttribute('data-eo-href',a.href);
        if(id!=null)a.setAttribute('data-eo-ent',String(this._frameIds.push(id)-1));
      });}catch(e){}
      // delegated listeners — rebindable so hot-reloads/new instances take effect
      if(d.__eoHandlers){d.removeEventListener('click',d.__eoHandlers.click,true);d.removeEventListener('mouseover',d.__eoHandlers.over,true);d.removeEventListener('mouseout',d.__eoHandlers.out,true);if(d.__eoHandlers.move)d.removeEventListener('mousemove',d.__eoHandlers.move,true);}
      const onClick=ev=>{const s=ev.target.closest&&ev.target.closest('[data-eo-ent]');
        if(s){ev.preventDefault();ev.stopPropagation();const id=this._frameIds[+s.getAttribute('data-eo-ent')];if(id==null)return;this.entLeave();
          // An entity that is ALSO a hyperlink has two actions — open its profile, or follow
          // the link. Don't pick for the user: offer both in a small modal at the click.
          const href=s.getAttribute('data-eo-href');const o=this._frameOffset();const act=this.state.clickAction||'ask';
          if(href&&act==='link'){this.goWeb(href);}
          else if(href&&act==='ask'){this.openLinkChoice(id,href,{clientX:o.x+ev.clientX,clientY:o.y+ev.clientY});}
          else this.clickEntity(id);
          return;}
        // A plain in-page link opens in the CENTER viewport as a new in-app tab — not a real browser tab.
        const a=ev.target.closest&&ev.target.closest('a[href]');
        if(a){const href=a.href||a.getAttribute('href');if(href&&/^https?:/i.test(href)){ev.preventDefault();ev.stopPropagation();this.entLeave();this.goWeb(href);}}};
      const onOver=ev=>{const s=ev.target.closest&&ev.target.closest('[data-eo-ent]');
        if(s){const id=this._frameIds[+s.getAttribute('data-eo-ent')];if(id==null)return;const href=s.getAttribute('data-eo-href')||null;const o=this._frameOffset();clearTimeout(this._prevT);this.entHover(id,{clientX:o.x+ev.clientX,clientY:o.y+ev.clientY},href);return;}
        // A wiki link that is NOT a folded entity → dwell pivots to a link preview.
        const a=ev.target.closest&&ev.target.closest('a[data-eo-wiki]');
        if(a&&!a.hasAttribute('data-eo-ent')){clearTimeout(this._pivotT);this.wikiPreviewHover(a.getAttribute('data-eo-href')||a.href);}};
      const onOut=ev=>{const s=ev.target.closest&&ev.target.closest('[data-eo-ent]');if(s)this.entLeave();};
      // Settle-to-pivot: while the cursor is still MOVING over an entity, keep deferring
      // the dwell timer. It fires only once the cursor comes to rest — so sweeping the
      // mouse across the text while reading never yanks the panel from entity to entity.
      const onMove=ev=>{if(this._hovEnt==null)return;const s=ev.target.closest&&ev.target.closest('[data-eo-ent]');if(!s)return;
        // Keep deferring the card while the cursor is still travelling, and track where
        // it rests so the card lands at the settled spot — sweeping never pops anything.
        if(this._pendHover&&this.state.hoverEnt!==this._pendHover.id){const o=this._frameOffset();this._pendHover.x=o.x+ev.clientX;this._pendHover.y=o.y+ev.clientY;this._armHoverCard();}
        if((this.state.hoverPivot||'dwell')==='dwell')this._armPivot(this._hovEnt);};
      d.addEventListener('click',onClick,true);d.addEventListener('mouseover',onOver,true);d.addEventListener('mouseout',onOut,true);d.addEventListener('mousemove',onMove,true);
      d.__eoHandlers={click:onClick,over:onOver,out:onOut,move:onMove};d.__eoBound=true;
    }catch(e){}
  }
  _armPivot(id){
    const mode=this.state.hoverPivot||'dwell';
    if(mode==='off'||id==null)return;
    clearTimeout(this._pivotT);
    const delay=mode==='hover'?60:(this.state.hoverDelay||1100);
    this._pivotT=setTimeout(()=>{if(this._hovEnt===id)this.setState({panelSel:id,previewWiki:null,rightOpen:true});},delay);
  }
  entHover(id,ev,href){clearTimeout(this._hovT);this._stopCardWatch();
    this._hovEnt=id;
    const x=(ev&&ev.clientX)||0,y=(ev&&ev.clientY)||0;
    this._pendHover={id,href:href||null,x,y};
    // The card appears only once the cursor SETTLES on an entity — a glance while
    // reading, or sweeping the mouse across the text, never pops it up (see onMove,
    // which keeps re-arming the timer until the cursor stops moving).
    this._armHoverCard();
    // Pivot likewise fires only on a settled dwell; leaving cancels both
    // (the _hovEnt===id checks below).
    clearTimeout(this._prevT);
    this._armPivot(id);
  }
  _armHoverCard(){
    const ph=this._pendHover;if(!ph||this._hovEnt!==ph.id)return;
    if(this.state.hoverEnt===ph.id)return; // already showing — keep it steady, don't re-pop
    clearTimeout(this._cardT);
    const delay=(this.state.hoverPivot==='hover')?90:340;
    this._cardT=setTimeout(()=>{const p=this._pendHover;if(!p||this._hovEnt!==p.id)return;
      this.setState({hoverEnt:p.id,hoverHref:p.href,hoverXY:{x:p.x,y:p.y}});
      this._startCardWatch(p.x,p.y);},delay);
  }
  // Anti-stick: once the card is up, watch the real pointer. The instant it leaves both
  // the card (with a small bridge) and a radius around the word that opened it, drop it.
  // This is geometric, so it can't get stranded by a missed mouseenter/leave pair.
  _startCardWatch(tx,ty){
    this._stopCardWatch();
    this._cardWatch=(e)=>{
      let inside=false;
      const el=document.getElementById('eo-hovercard');
      if(el){const r=el.getBoundingClientRect();const pad=26;
        if(e.clientX>=r.left-pad&&e.clientX<=r.right+pad&&e.clientY>=r.top-pad&&e.clientY<=r.bottom+pad)inside=true;}
      if(!inside){const dx=e.clientX-tx,dy=e.clientY-ty;if(dx*dx+dy*dy<=44*44)inside=true;}
      if(!inside)this._hideCardNow();
    };
    window.addEventListener('mousemove',this._cardWatch,true);
  }
  _stopCardWatch(){if(this._cardWatch){window.removeEventListener('mousemove',this._cardWatch,true);this._cardWatch=null;}}
  _hideCardNow(){this._stopCardWatch();clearTimeout(this._cardT);clearTimeout(this._hovT);clearTimeout(this._pivotT);this._pendHover=null;this._hovEnt=null;if(this.state.hoverEnt!=null)this.setState({hoverEnt:null,hoverHref:null});}
  // A hyperlink that ISN'T a folded entity (e.g. "Proceedings of the National Academy
  // of Sciences") still has a referent — its Wikipedia article. Dwelling on it pivots
  // the panel to a lightweight preview of that article, with a way to read it in.
  wikiPreviewHover(href){
    if((this.state.hoverPivot||'dwell')==='off')return;
    const m=String(href||'').match(/\/wiki\/([^#?:]+)$/);if(!m)return;
    const title=decodeURIComponent(m[1]).replace(/_/g,' ');
    clearTimeout(this._prevT);this._prevHref=href;
    const delay=this.state.hoverPivot==='hover'?60:(this.state.hoverDelay||1100);
    this._prevT=setTimeout(()=>{if(this._prevHref!==href)return;
      this.setState({previewWiki:{title,href,loading:true,extract:'',desc:''},panelSel:null,rightOpen:true});
      this._fetchWikiPreview(title,href);},delay);
  }
  async _fetchWikiPreview(title,href){
    this._wikiPrev=this._wikiPrev||{};
    if(this._wikiPrev[title]){if(this.state.previewWiki&&this.state.previewWiki.href===href)this.setState({previewWiki:{...this._wikiPrev[title],href}});return;}
    try{const d=await this._wikiSummary(title);
      const rec={title:d.title||title,extract:this.norm(d.extract||''),desc:d.description||'',thumb:(d.thumbnail&&d.thumbnail.source)||null,url:(d.content_urls&&d.content_urls.desktop&&d.content_urls.desktop.page)||href,loading:false};
      this._wikiPrev[title]=rec;
      if(this.state.previewWiki&&this.state.previewWiki.href===href)this.setState({previewWiki:{...rec,href}});
    }catch(e){if(this.state.previewWiki&&this.state.previewWiki.href===href)this.setState({previewWiki:{title,href,loading:false,extract:'',err:true}});}
  }
  closePreview(){clearTimeout(this._prevT);this._prevHref=null;if(this.state.previewWiki)this.setState({previewWiki:null});}
  entLeave(){clearTimeout(this._cardT);clearTimeout(this._pivotT);this._pendHover=null;this._hovEnt=null;clearTimeout(this._hovT);this._hovT=setTimeout(()=>{this._stopCardWatch();this.setState({hoverEnt:null,hoverHref:null});},220);}
  keepHover(){clearTimeout(this._hovT);}
  hoverProfile(){const id=this.state.hoverEnt;clearTimeout(this._hovT);this.setState({hoverEnt:null,hoverHref:null});if(id==null)return;this.clickEntity(id);}
  hoverLink(){const u=this.state.hoverHref;clearTimeout(this._hovT);this.setState({hoverEnt:null,hoverHref:null});if(u){try{this.goWeb(u);}catch(e){}}}
  hoverVals(base){const g=this.graph,he=this.state.hoverEnt;if(!(he&&g&&g.entities.has(he)))return;
    const hl=this.labelOf(he),hm=this.mentionsOf(he),hs=this.sourcesOf(he),hn=this.neighbors(he);
    const hb={eva:0,def:0,held:0};hm.forEach(i=>hb[this.bandOf(i)]++);const ht=hb.eva+hb.def+hb.held||1;let l2,c2;if(hb.eva/ht>=.45){l2='well attested';c2='#1d4ed8';}else if(hb.def/ht>=.4){l2='mostly asserted';c2='#b45309';}else{l2='mostly mentioned';c2='#6b7280';}
    const vw=(typeof window!=='undefined'&&window.innerWidth)||960,x=Math.min(this.state.hoverXY.x+6,vw-290),y=this.state.hoverXY.y+18;
    const heHref=this.state.hoverHref;
    base.hoverCardOn=true;base.hoverCard={name:hl,av:this.initials(hl),avStyle:this.avatar(hl,34),onEnter:()=>this.keepHover(),onLeave:()=>this.entLeave(),onProfile:()=>{this._stopCardWatch();clearTimeout(this._hovT);clearTimeout(this._pivotT);this.setState({hoverEnt:null,hoverHref:null});this.clickEntity(he);},hasLink:!!this.state.hoverHref,noLink:!this.state.hoverHref,linkHost:this.short(this.state.hoverHref||''),onLink:()=>{this._stopCardWatch();clearTimeout(this._hovT);this.setState({hoverEnt:null,hoverHref:null});if(heHref){try{this.goWeb(heHref);}catch(e){}}},stat:(g.entities.get(he).sightings||hm.length)+'× · '+hn.length+' links · '+hs.length+' sources',gist:this.norm(this.master.sentences[g.entities.get(he).firstSeen]||this.master.sentences[hm[0]]||'').slice(0,150),est:l2,estStyle:'color:'+c2+';font-weight:600;',segs:[[hb.eva,'#1d4ed8'],[hb.def,'#b45309'],[hb.held,'#6b7280']].filter(([n])=>n>0).map(([n,c])=>({style:'width:'+(n/ht*100)+'%;background:'+c+';display:block;'})),wrap:'position:fixed;left:'+x+'px;top:'+y+'px;width:270px;background:var(--card);border:1px solid var(--line);border-radius:12px;box-shadow:0 10px 30px rgba(20,24,30,.16);padding:13px 14px;z-index:30;animation:eopop .12s ease-out;'};}

  async research(focalId,modeOverride){
    const id=focalId||this.state.selId; if(this._busy||!id)return;const focal=this.labelOf(id);this._feedEnt=id;
    const mode=modeOverride||this.state.mode;
    const dir=this.state.direction.trim();const fr=this.frontier(id);
    const query=dir||(fr[0]&&fr[0].query)||focal;
    this._busy=true;this.setState({busy:true,liveResearch:{on:true,focal:id,phase:'search',host:'',added:0}});
    const preSent=this.master.sentences.length;
    const preMF=this.mentionsOf(id).length,preSF=this.sourcesOf(id).length;
    // Capture the focal entity's specific referents BEFORE reading anything new, and the
    // page this research is launched from — researched sources nest under it.
    const focalProper=this.corefContext(id).proper||new Set();
    const parentUrl=this.state.viewUrl||this.sourcesOf(id)[0]||null;
    this.feedSep('research'+(dir?' · '+dir:'')+' · '+mode);
    this.feedLine('search','Searching the web for “'+query+'”');await this.sleep(300);
    let links;try{links=await this.searchLinks(query,mode==='breadth'?8:6);}catch(e){this.feedLine('warn','Search unavailable ('+e.message+') — paste a URL up top to research directly.');this._busy=false;this.setState({busy:false,liveResearch:{on:false}});return;}
    links=(links||[]).filter(u=>!this.state.pages.find(p=>p.url===u||p.url==='https://'+u));
    if(!links.length){this.feedLine('warn','No new candidates found.');this._busy=false;this.setState({busy:false,liveResearch:{on:false}});return;}
    this.feedLine('found','Found '+links.length+' sources: '+links.map(l=>this.short(l)).join(', '));await this.sleep(300);
    const before={ents:this.graph.entities.size,srcs:this.state.pages.length};
    // Many top hits are anti-bot walls (Cloudflare "Just a moment…") or JS shells that the
    // proxy can't render — those read as empty. So don't stop at a fixed slice: walk DOWN the
    // candidate list and keep reading until `want` sources actually land. Blocked/empty/off-topic
    // pages are skipped, not counted, so one bad top result no longer sinks the whole pass.
    const want=mode==='breadth'?3:1; let got=0,attempts=0;
    for(let i=0;i<links.length&&got<want&&attempts<8;i++){const url=links[i];const preEnts=this.graph.entities.size;attempts++;
      this.setState(s=>({liveResearch:{...(s.liveResearch||{}),on:true,focal:id,phase:'read',host:this.short(url)}}));
      this.feedLine('read','Reading '+this.short(url)+' …');await this.sleep(200);
      const res=await this.readURL(url,'REAFFERENCE',parentUrl);await this.sleep(200);
      if(!res){continue;} // readURL already logged why (blocked, too little text) — try the next candidate
      if(!this.pageRelevant(url,focalProper)){this.tossPage(url);this.feedLine('warn','Set aside '+this.short(url)+' — not about '+focal+' (no shared referents)');await this.sleep(140);continue;}
      got++;
      const grew=this.graph.entities.size-preEnts;this.feedLine('graph','Read “'+res.title+'” · +'+Math.max(0,grew)+' entities, +1 source');
      this.setState(s=>({liveResearch:{...(s.liveResearch||{}),added:this.master.sentences.length-preSent}}));await this.sleep(160);
    }
    if(!got)this.feedLine('warn','Every candidate was blocked or off-topic — paste a specific URL up top to read it directly.');
    const d={ents:this.graph.entities.size-before.ents,srcs:this.state.pages.length-before.srcs};
    this.feedLine('done','Done. Memory gained '+d.ents+' entities across '+d.srcs+' new source'+(d.srcs!==1?'s':'')+'. '+focal+' now has '+this.sourcesOf(id).length+' sources.');
    this._busy=false;this.setState({busy:false,liveResearch:{on:false,focal:id,phase:'done',host:'',added:this.master.sentences.length-preSent,addedFocal:this.mentionsOf(id).length-preMF,srcFocal:this.sourcesOf(id).length-preSF}});
    setTimeout(()=>{ if(this.state.liveResearch&&this.state.liveResearch.phase==='done')this.setState({liveResearch:{on:false}}); },4000);
  }

  chip(url,active){const c=this.hashColor(this.short(url));return {style:'display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;border-radius:6px;padding:2px 7px;cursor:pointer;transition:all .12s;'+(active?'color:var(--ink);background:#eef3fc;border:1px solid '+c+';':'color:var(--ink2);background:#f4f5f7;border:1px solid var(--line2);'),dot:'width:7px;height:7px;border-radius:50%;background:'+c+';display:inline-block;flex-shrink:0;'};}
  avatar(label,size){const c=this.hashColor(label);return 'width:'+size+'px;height:'+size+'px;flex:0 0 auto;border-radius:'+(size*0.28)+'px;background:'+c+'1a;color:'+c+';display:flex;align-items:center;justify-content:center;font-size:'+(size*0.34)+'px;font-weight:700;letter-spacing:-.02em;';}
  srcId(url){const p=this.pageOf(url);const i=p?this.master.pages.indexOf(p):-1;return 'S'+(i+1);}

  // The top activity bar — what the reader is doing right now, drawn from the live
  // busy flag and the running feed. Requires no entity selection, so first-read
  // failures (bad URL, too-little-text) surface here instead of vanishing.
  activityVals(){
    const ready=this.state.ready, busy=this.state.busy, n=this.state.pages.length;
    const lines=(this.state.feed||[]).filter(l=>!l.sep);
    const last=lines[lines.length-1];
    const label=!ready?'Loading':(busy?'Working':(n?'Idle':'Ready'));
    const color=!ready?'#6b7280':(busy?'#b45309':(n?'#5a626d':'#15803d'));
    let text;
    if(last)text=last.t;
    else if(!ready)text='Starting the reading engine…';
    else if(!n)text='Paste a URL above or pick a suggestion to begin.';
    else text='Up to date — '+n+' source'+(n!==1?'s':'')+' read. Hit Research when you want more.';
    const dot=busy
      ?'width:12px;height:12px;border-radius:50%;border:2px solid '+color+';border-top-color:transparent;animation:eospin .8s linear infinite;display:inline-block;flex:0 0 auto;box-sizing:border-box;'
      :'width:8px;height:8px;border-radius:50%;background:'+color+';display:inline-block;flex:0 0 auto;'+((ready&&!n)?'animation:eopulse 2s infinite;':'');
    const FEED={search:{i:'⌕',c:'#2563eb'},found:{i:'≣',c:'#2563eb'},read:{i:'▤',c:'#b45309'},graph:{i:'＋',c:'#15803d'},done:{i:'✓',c:'#15803d'},warn:{i:'!',c:'#dc2626'}};
    const trail=lines.slice(-6).map(l=>{const f=FEED[l.k]||{i:'·',c:'#9aa1ab'};return {icon:f.i,full:l.t,style:'width:19px;height:19px;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:'+f.c+';background:'+f.c+'18;flex:0 0 auto;'};});
    return {busy,label,labelColor:color,text,dotStyle:dot,barBg:busy?'#fdfaf3':'var(--card)',trail,hasTrail:trail.length>0,textStyle:''};
  }

  renderVals(){
    const ready=this.state.ready,g=this.graph,active=this.state.pinSrc||this.state.hoverSrc;
    const _acc=this.curAccent();
    const base={accentVar:_acc,accbgVar:this.mixWhite(_acc,.90),acclineVar:this.mixWhite(_acc,.70),
      settingsOpen:this.state.settingsOpen,onToggleSettings:()=>this.toggleSettings(),onCloseSettings:()=>this.closeSettings(),
      memOpen:this.state.memOpen,onOpenMem:()=>this.setState({memOpen:true,settingsOpen:false}),onCloseMem:()=>this.setState({memOpen:false}),memStop:e=>{if(e&&e.stopPropagation)e.stopPropagation();},mem:(this.state.memOpen?this.memoryLog():{rows:[],hasRows:false,statLine:'',empty:true}),
      memTab:this.state.memTab||'sources',memTabSources:(this.state.memTab||'sources')==='sources',memTabLog:this.state.memTab==='log',
      onMemSources:()=>this.setState({memTab:'sources'}),onMemLog:()=>this.setState({memTab:'log'}),
      memSourcesTabStyle:((this.state.memTab||'sources')==='sources'?'background:var(--card);color:var(--ink);box-shadow:0 1px 2px rgba(0,0,0,.08);':'color:var(--ink3);'),
      memLogTabStyle:(this.state.memTab==='log'?'background:var(--card);color:var(--ink);box-shadow:0 1px 2px rgba(0,0,0,.08);':'color:var(--ink3);'),
      memNote:((this.state.memOpen&&this.state.memTab==='log')?this.memoryNotation():{rows:[],count:0,shown:0}),
      themeSwatches:this.THEMES.map(t=>({name:t.name,hex:t.hex,active:t.hex.toLowerCase()===_acc.toLowerCase(),onPick:()=>this.setAccent(t.hex),
        style:'width:26px;height:26px;border-radius:7px;cursor:pointer;background:'+t.hex+';box-shadow:0 0 0 '+(t.hex.toLowerCase()===_acc.toLowerCase()?'2px var(--card),0 0 0 4px '+t.hex:'1px rgba(0,0,0,.12) inset')+';'})),
      hlOptions:['marker','underline','off'].map(k=>({k,label:k==='marker'?'Highlight':k==='underline'?'Underline':'Off',active:this.state.highlightStyle===k,onPick:()=>this.setHighlight(k),
        style:'flex:1;font-size:11.5px;font-weight:600;text-align:center;padding:6px 4px;border-radius:6px;cursor:pointer;'+(this.state.highlightStyle===k?'background:var(--card);color:var(--ink);box-shadow:0 1px 2px rgba(0,0,0,.08);':'color:var(--ink3);')})),
      hoverOptions:[['dwell','On dwell'],['hover','Instant'],['off','Off']].map(([k,label])=>({k,label,active:this.state.hoverPivot===k,onPick:()=>this.setHoverPivot(k),
        style:'flex:1;font-size:11.5px;font-weight:600;text-align:center;padding:6px 4px;border-radius:6px;cursor:pointer;'+(this.state.hoverPivot===k?'background:var(--card);color:var(--ink);box-shadow:0 1px 2px rgba(0,0,0,.08);':'color:var(--ink3);')})),
      hoverDesc:this.state.hoverPivot==='off'?'Hovering never moves the panel — use it only to peek the card. Click to open a profile.':this.state.hoverPivot==='hover'?'The panel follows your cursor immediately. Fastest, but moves a lot while reading.':'The panel pivots only after you rest on an entity for a moment. Glancing past won’t move it.',
      dwellOn:this.state.hoverPivot==='dwell',dwellGap:this.state.hoverPivot==='dwell'?'12px':'16px',
      hoverDelay:this.state.hoverDelay,hoverDelayLabel:(this.state.hoverDelay>=1000?(this.state.hoverDelay/1000).toFixed(this.state.hoverDelay%1000?1:0):this.state.hoverDelay)+(this.state.hoverDelay>=1000?'s':'ms'),
      onHoverDelay:e=>this.setHoverDelay(e.target.value),
      clickOptions:[['ask','Ask'],['profile','Profile'],['link','Go to link']].map(([k,label])=>({k,label,active:this.state.clickAction===k,onPick:()=>this.setClickAction(k),
        style:'flex:1;font-size:11.5px;font-weight:600;text-align:center;padding:6px 4px;border-radius:6px;cursor:pointer;'+(this.state.clickAction===k?'background:var(--card);color:var(--ink);box-shadow:0 1px 2px rgba(0,0,0,.08);':'color:var(--ink3);')})),
      clickDesc:this.state.clickAction==='ask'?'When an entity is also a hyperlink, clicking asks whether to open its profile or follow the link.':this.state.clickAction==='profile'?'Clicking always opens the entity’s profile. Follow the link from the hover card instead.':'Clicking always follows the hyperlink. Open the profile from the hover card instead.',
      url:this.state.url,onUrlInput:e=>this.onUrlInput(e),onUrlKey:e=>this.onUrlKey(e),onReadUrl:()=>this.doReadUrl(),
      onBack:()=>this.goBack(),onForward:()=>this.goForward(),onReloadTop:()=>this.forceUpdate(),onNewTab:()=>this.newTab(),
      onImportClick:()=>this.onImportClick(),onImportFile:e=>this.onImportFile(e),
      onToggleDetect:()=>this.toggleDetect(),detect:this.state.detect,showWeb:false,web:null,srcCtxOn:false,
      detectDesc:this.state.detect?'On — every page you open is read into memory.':'Off — pages open without being read. Turn on to build memory.',
      detectSwitch:'flex:0 0 auto;width:34px;height:20px;border-radius:11px;padding:2px;transition:background .15s;background:'+(this.state.detect?'var(--acc)':'#cfd3da')+';',
      detectKnob:'width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.2);transition:transform .15s;transform:translateX('+(this.state.detect?'14px':'0')+');',
      onToggleAudit:()=>this.toggleAudit(),
      auditDesc:this.state.auditMode?'On — each entity shows its raw graph contents, the integral fold vs. Wikipedia, and the sources in play.':'Off — turn on to inspect coref, definitions, and the propositions behind each profile.',
      auditSwitch:'flex:0 0 auto;width:34px;height:20px;border-radius:11px;padding:2px;transition:background .15s;background:'+(this.state.auditMode?'var(--acc)':'#cfd3da')+';',
      auditKnob:'width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.2);transition:transform .15s;transform:translateX('+(this.state.auditMode?'14px':'0')+');',
      tabs:this.buildTabs(g),hasTabs:(this._hist&&this._hist.length>0),
      backStyle:this.navBtnStyle(this.canBack()),fwdStyle:this.navBtnStyle(this.canForward()),
      readBtnLabel:this.state.busy?'…':'Read',readBtnStyle:'font-size:12px;font-weight:600;color:#fff;background:var(--acc);border:none;border-radius:7px;padding:6px 13px;flex:0 0 auto;cursor:pointer;'+(this.state.busy?'opacity:.6;':''),
      onSearch:e=>this.onSearch(e),inboxCount:'',inbox:[],inboxEmpty:true,groups:[],hasEgo:false,
      chats:[],hasChats:false,chatOn:false,chat:null,chatInput:this.state.chatInput||'',askPageOn:false,
      onNewChat:()=>this.newChat(null),onChatInput:e=>this.onChatInput(e),onChatKey:e=>this.onChatKey(e),onSendChat:()=>this.sendChat(),onCloseChat:()=>this.closeChat(),onAskPage:()=>this.askThisPage(),
      backend:this.state.backend||'webllm',
      backendOptions:[{v:'webllm',label:'Llama-3.2-3B · runs in your browser'},{v:'echo',label:'Echo · offline, no model'}].map(o=>{const sel=(this.state.backend||'webllm')===o.v;return {v:o.v,label:o.label,sel,onPick:()=>this.setBackend(o.v),
        style:'font-size:12px;font-weight:600;text-align:left;padding:8px 11px;border-radius:8px;cursor:pointer;border:1px solid '+(sel?'var(--accline)':'var(--line2)')+';background:'+(sel?'var(--accbg)':'var(--card)')+';color:'+(sel?'var(--acc)':'var(--ink2)')+';'};}),
      sources:[],srcCount:0,srcEmpty:true,rightOpen:this.state.rightOpen,rightClosed:!this.state.rightOpen,onToggleRight:()=>this.toggleRight(),panelProfileOn:false,panelListOn:true,panelPageOn:false,pageOverview:null,listFromPage:false,onShowAllEntities:()=>this.showAllEntities(),onShowOverview:()=>this.showOverview(),panelProfile:null,previewOn:false,preview:null,
      pageLinked:this.state.linkMode,onTogglePlain:()=>this.toggleLinkMode(),
      plainLabel:this.state.linkMode?'Names linked':'Plain text',
      plainTitle:this.state.linkMode?'Known names are highlighted and clickable. Click to read plain, unmarked text.':'Page is plain text. Click to highlight and link known names again.',
      plainBtnStyle:'display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:600;border-radius:7px;padding:5px 10px;flex:0 0 auto;cursor:pointer;'+(this.state.linkMode?'color:var(--acc);background:var(--accbg);border:1px solid var(--accline);':'color:var(--ink2);background:var(--app);border:1px solid var(--line2);'),
      cursor:{label:ready&&this.master?('line '+this.master.sentences.length):'—',title:ready&&this.master?('Projection at the latest read · '+this.state.pages.length+' pages · '+this.master.sentences.length+' sentences'):'no data yet'},
      liveColor:this.state.busy?'#b45309':'#22a06b',liveLabel:this.state.busy?'Working…':(ready?'Engine ready':'Loading…'),
      hasSel:false,showPrompt:false,promptTitle:'',promptBody:'',suggestions:[],
      ledger:[],ledgerCount:0,ledgerEmpty:true,hoverCardOn:false,srcOpen:false,
      direction:this.state.direction,onDirInput:e=>this.onDirInput(e),mode:this.state.mode,
      leftOpen:this.state.leftOpen,toggleLeft:()=>this.setState(s=>({leftOpen:!s.leftOpen})),
      leftIcon:this.state.leftOpen?'‹':'☰',leftTitle:this.state.leftOpen?'Hide entities panel':'Show entities panel',
      // Layout columns. The sources/chats side is 264px, the entity panel is panelW;
      // when swapped, the panel sits on the left and the columns/orders mirror.
      gridCols:(this.state.swapped
        ? (this.state.rightOpen?((this.state.panelW||380)+'px '):'')+'minmax(0,1fr)'+(this.state.leftOpen?' 264px':'')
        : (this.state.leftOpen?'264px ':'')+'minmax(0,1fr)'+(this.state.rightOpen?(' '+(this.state.panelW||380)+'px'):'')),
      leftOrder:this.state.swapped?3:1,mainOrder:2,rightOrder:this.state.swapped?1:3,
      onSwap:()=>this.toggleSwap(),swapTitle:this.state.swapped?'Swap panels back (sources left)':'Swap panels (sources right)',
      swapBtnStyle:'width:30px;height:30px;flex:0 0 auto;border:1px solid '+(this.state.swapped?'var(--accline)':'var(--line2)')+';background:'+(this.state.swapped?'var(--accbg)':'var(--app)')+';border-radius:8px;color:'+(this.state.swapped?'var(--acc)':'var(--ink2)')+';display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:15px;line-height:1;',
      panelW:this.state.panelW||380,onResizeDown:e=>this.onResizeDown(e),onResizeReset:()=>this.onResizeReset(),
      resizeHandleStyle:'position:fixed;top:54px;bottom:0;right:'+((this.state.panelW||380)-3)+'px;width:9px;z-index:40;cursor:col-resize;display:'+(this.state.swapped?'none':'flex')+';align-items:center;justify-content:center;',
      closeSource:()=>this.closeSource(), linkChoiceOn:false, closeLinkChoice:()=>this.closeLinkChoice() };
    base.activity=this.activityVals();
    this.chatVals(base);

    // Right-panel tabs: Entities | Chat. The chat DOCKS into the right panel by default
    // (alongside the entities); the detach affordance pops it back out into the main drawer.
    base.chatDocked=this.state.chatDock!==false;
    base.showChatTab=base.chatDocked&&base.chatOn;          // tab bar appears only when a chat exists & is docked
    base.rightChatOn=base.showChatTab&&(this.state.rightTab||'chat')==='chat';
    base.rightEntitiesOn=!base.rightChatOn;
    base.chatInMain=base.chatOn&&!base.chatDocked;          // detached → render in <main> as before
    base.rightTabEntActive=!base.rightChatOn;
    base.onRightTabEnt=()=>this.setState({rightTab:'entities'});
    base.onRightTabChat=()=>this.setState({rightTab:'chat'});
    const _tabOn='flex:1;text-align:center;font-size:11.5px;font-weight:700;padding:7px 6px;border-radius:7px;cursor:pointer;border:none;background:var(--card);color:var(--ink);box-shadow:0 1px 2px rgba(0,0,0,.08);',
          _tabOff='flex:1;text-align:center;font-size:11.5px;font-weight:600;padding:7px 6px;border-radius:7px;cursor:pointer;border:none;background:transparent;color:var(--ink3);';
    base.rightTabEntStyle=base.rightTabEntActive?_tabOn:_tabOff;base.rightTabChatStyle=base.rightChatOn?_tabOn:_tabOff;

    // Project Gutenberg search results take the center when present (and no chat open).
    base.gutenOn=!base.chatInMain&&!this.state.viewUrl&&(this.state.gutenLoading||this.state.gutenResults!=null);
    base.guten={loading:!!this.state.gutenLoading,query:this.state.gutenQuery||'',
      hasResults:!!(this.state.gutenResults&&this.state.gutenResults.length),
      empty:!!(this.state.gutenResults&&!this.state.gutenResults.length),
      onClear:()=>this.setState({gutenResults:null,gutenQuery:''}),
      results:(this.state.gutenResults||[]).map(b=>{const reading=this.state.gutenReading===b.id;
        return {title:b.title,author:b.author,downloads:(b.downloads||0).toLocaleString()+' downloads',reading,
          btnLabel:reading?'Reading…':'Read fully',onRead:()=>this.readGutenberg(b),
          rowStyle:'display:flex;align-items:center;gap:14px;padding:14px 16px;border:1px solid var(--line);border-radius:12px;margin-bottom:10px;background:var(--card);',
          btnStyle:'flex:0 0 auto;font-size:12px;font-weight:600;color:#fff;background:'+(reading?'#9aa1ab':'var(--acc)')+';border:none;border-radius:9px;padding:8px 14px;cursor:'+(reading?'default':'pointer')+';'};})};

    const vu=this.state.viewUrl;
    base.askPageOn=!!vu&&!base.chatOn;   // the discoverable "Ask about this page" FAB
    if(vu){
      base.showWeb=true;
      base.web={url:vu,host:/^text:/i.test(vu)?((this.pageOf(vu)||{}).title||'Imported text'):this.short(vu),loading:!!this.state.pageLoading&&!this.state.pageDoc,
        err:(this.state.pageErr&&!this.state.pageDoc)?this.state.pageErr:null,hasDoc:!!this.state.pageDoc,doc:this.state.pageDoc||'',
        onReloadPage:()=>this.loadCenter(vu),detecting:this.state.detect&&this.state.busy};
    }

    const sm=this.state.sortMode||'updated';
    const sOn='font-size:10.5px;font-weight:600;color:var(--acc);background:var(--card);border:none;border-radius:5px;padding:3px 8px;cursor:pointer;box-shadow:0 1px 1px rgba(0,0,0,.05);',
          sOff='font-size:10.5px;font-weight:500;color:var(--ink2);background:transparent;border:none;border-radius:5px;padding:3px 8px;cursor:pointer;';
    base.sortUpdatedStyle=sm==='updated'?sOn:sOff;base.sortTopStyle=sm==='mentions'?sOn:sOff;base.sortAzStyle=sm==='name'?sOn:sOff;
    base.onSortUpdated=()=>this.setState({sortMode:'updated'});base.onSortTop=()=>this.setState({sortMode:'mentions'});base.onSortAz=()=>this.setState({sortMode:'name'});

    if(!ready||!g||this.state.pages.length===0){
      if(!vu&&!base.chatOn&&!base.gutenOn){
        base.showPrompt=true;
        base.promptTitle=this.state.engineErr?'Engine failed to load':(ready?'Read a URL — or find a book':'Loading the reading engine…');
        base.promptBody=this.state.engineErr?String(this.state.engineErr):'Paste a page URL to read it here, type a title or author to find a book on Project Gutenberg, or use 📄 to import your own. Every entity is read into the graph on the right — then ask about it in a chat.';
        base.suggestions=this.SUGG.map(s=>({label:s.label,onPick:s.book?(()=>this.readGutenberg(s.book)):(()=>{this.setState({url:s.url});setTimeout(()=>this.doReadUrl(),20);})}));
        base.ent={name:'',gist:'',av:'',avStyle:'',meta:{sightings:0}};
      }
      return base;
    }

    const sel=this.state.selId&&g.entities.has(this.state.selId)?this.state.selId:this.topEntity();
    const q=(this.state.query||'').toLowerCase().trim();
    const lastSeen=new Map(),srcTally=new Map();
    for(const ev of this.master.events){if(ev.sentIdx==null)continue;const su=this.master.sentenceSource[ev.sentIdx];for(const x of [ev.id,ev.src,ev.tgt].filter(Boolean)){const r=g.representative(x);if((lastSeen.get(r)||-1)<ev.sentIdx)lastSeen.set(r,ev.sentIdx);if(su){let m=srcTally.get(r);if(!m){m=new Map();srcTally.set(r,m);}m.set(su,(m.get(su)||0)+1);}}}
    const ents=[...g.entities.values()].filter(e=>this.showable(e.id)&&(e.sightings||0)>=1);
    const cmp=sm==='name'?(a,b)=>this.labelOf(a.id).localeCompare(this.labelOf(b.id))
      :sm==='mentions'?(a,b)=>(b.sightings||0)-(a.sightings||0)||this.weightOf(b)-this.weightOf(a)
      :(a,b)=>((lastSeen.get(b.id)||0)-(lastSeen.get(a.id)||0))||this.weightOf(b)-this.weightOf(a);
    ents.sort(cmp);
    const primaryOf=new Map();
    ents.forEach(e=>{const m=srcTally.get(e.id);let best=null,bc=-1;if(m)for(const [u,c] of m){if(c>bc){bc=c;best=u;}}primaryOf.set(e.id,best);});
    const pagesByRecency=[...this.master.pages].sort((a,b)=>b.ts-a.ts);
    const bucket=new Map();pagesByRecency.forEach(p=>bucket.set(p.url,[]));
    const fallback=pagesByRecency.length?pagesByRecency[0].url:null;
    ents.forEach(e=>{let u=primaryOf.get(e.id);if(u==null||!bucket.has(u))u=fallback;if(u!=null&&bucket.has(u))bucket.get(u).push(e);});
    const groups=[];let shownTotal=0;
    pagesByRecency.forEach((p,gi)=>{let arr=bucket.get(p.url)||[];if(q)arr=arr.filter(e=>this.labelOf(e.id).toLowerCase().includes(q));if(!arr.length)return;shownTotal+=arr.length;const ov=this.state.openGroups[p.url];const open=q?true:(ov===undefined?gi===0:ov!==false);groups.push({sid:this.srcId(p.url),title:this.truncLabel(p.title,28),count:arr.length,open,caret:open?'▾':'▸',onToggle:()=>this.setState(s=>({openGroups:{...s.openGroups,[p.url]:!open}})),items:open?arr.slice(0,100).map(e=>this.entRow(e,sel)):[]});});
    base.groups=groups;base.inboxEmpty=shownTotal===0;base.inboxCount=ents.length;
    base.ledgerCount=this.master.pages.length;base.ledgerEmpty=this.master.pages.length===0;
    // Sources nest under the page you intentionally opened: a researched source is a
    // child of the page its research was launched from. Render as an indented tree.
    const allP=this.master.pages;
    const inSet=u=>!!(u&&allP.find(x=>x.url===u));
    const childrenOf=u=>pagesByRecency.filter(p=>p.parent===u);
    const collapsed=this.state.collapsedSrc||{};
    const orderedP=[];const seenP=new Set();
    const markSeen=p=>{if(seenP.has(p.url))return;seenP.add(p.url);childrenOf(p.url).forEach(markSeen);};
    const pushP=(p,depth)=>{if(seenP.has(p.url))return;seenP.add(p.url);const kids=childrenOf(p.url);
      orderedP.push({p,depth,kids:kids.length,collapsed:!!collapsed[p.url]});
      // A collapsed parent hides its researched subtree — mark it seen so it can't resurface
      // through the orphan-recovery pass below.
      if(collapsed[p.url])kids.forEach(markSeen);
      else kids.forEach(c=>pushP(c,Math.min(depth+1,2)));};
    pagesByRecency.filter(p=>!inSet(p.parent)).forEach(p=>pushP(p,0));
    pagesByRecency.forEach(p=>{if(!seenP.has(p.url))pushP(p,0);});
    base.sources=orderedP.map(({p,depth,kids,collapsed:col})=>{const c=this.hashColor(this.short(p.url)),isA=vu===p.url,cnt=(bucket.get(p.url)||[]).length;
      return {label:this.truncLabel(p.title,depth?38:42),host:this.short(p.url),url:p.url,count:cnt,active:isA,onOpen:()=>this.goWeb(p.url),onChat:ev=>{if(ev&&ev.stopPropagation)ev.stopPropagation();this.newChat(p.url);},
        hasKids:kids>0,collapsed:col,caret:col?'▸':'▾',collapseTitle:(col?'Show':'Hide')+' the '+kids+' source'+(kids!==1?'s':'')+' found from this one',
        onToggleCollapse:ev=>{if(ev&&ev.stopPropagation)ev.stopPropagation();this.toggleSrcCollapse(p.url);},
        caretStyle:'width:22px;height:22px;flex:0 0 auto;border:none;background:transparent;color:var(--ink3);border-radius:6px;cursor:pointer;font-size:11px;line-height:1;',
        dot:'width:'+(depth?16:20)+'px;height:'+(depth?16:20)+'px;border-radius:6px;flex:0 0 auto;background:'+c+'1a;color:'+c+';display:flex;align-items:center;justify-content:center;font-size:'+(depth?8:9)+'px;font-weight:800;',
        glyph:depth?'↳':(p.via==='REAFFERENCE'?'⟲':this.short(p.url).slice(0,2).toUpperCase()),
        rowStyle:'display:flex;align-items:center;gap:10px;padding:'+(depth?'7px 11px':'9px 11px')+';border-radius:9px;margin-bottom:3px;margin-left:'+(depth*15)+'px;cursor:pointer;border:1px solid '+(isA?'var(--accline)':'transparent')+';background:'+(isA?'var(--accbg)':'transparent')+';'+(depth?'border-left:2px solid '+c+'55;border-radius:0 9px 9px 0;':'')};});
    base.srcCount=this.master.pages.length;base.srcEmpty=this.master.pages.length===0;

    if(vu){
      this.hoverVals(base);
      this.linkChoiceVals(base);
      base.listFromPage=true;
      if(this.state.panelSel&&g.entities.has(this.state.panelSel)){base.panelProfileOn=true;base.panelListOn=false;base.panelProfile=this.panelProfile(this.state.panelSel,vu);}
      else if(this.state.previewWiki){base.previewOn=true;base.panelListOn=false;base.preview=this.previewVals();}
      else if(this.state.panelMode!=='entities'){const ov=this.pageOverview(vu);if(ov){base.panelPageOn=true;base.panelListOn=false;base.pageOverview=ov;}}
      return base;
    }
    if(!sel){base.showPrompt=true;base.promptTitle='Select an entity';base.promptBody='Pick one from the list, or read another URL.';base.ent={name:'',gist:'',av:'',avStyle:'',meta:{sightings:0}};return base;}

    const e=g.entities.get(sel),lab=this.labelOf(sel),mentions=this.mentionsOf(sel),srcs=this.sourcesOf(sel),nbrs=this.neighbors(sel);
    const aliasCands=this.aliasesOf(sel).filter(a=>a!==lab);
    const realAliases=aliasCands.filter(a=>this.trueAlias(lab,a));
    const facets=aliasCands.filter(a=>!this.trueAlias(lab,a));
    const aliases=realAliases.slice(0,8).map(a=>({a,style:'display:inline-block;font-size:11.5px;padding:2px 8px;border-radius:6px;color:var(--ink2);border:1px solid var(--line2);'}));
    const subjIdx=this.subjectSentences(sel),subjSet=new Set(subjIdx),apprIdx=mentions.filter(i=>!subjSet.has(i));
    const attestedTexts=subjIdx.filter(i=>this.bandOf(i)==='eva').map(i=>this.master.sentences[i]);
    const cachedSum=this.state.summaries&&this.state.summaries[sel],sumSig=this.summarySig(sel),autoOn=false;
    let summaryText=null,sumModel=false,wikiBacked=false,wikiUrl=null,wikiTitle=null,wikiConf=false,srcComposed=false;
    if(cachedSum&&cachedSum.sig===sumSig){summaryText=cachedSum.text;sumModel=!!cachedSum.model;}
    else { summaryText=this.summaryFallback(attestedTexts); if(attestedTexts.length)setTimeout(()=>this.ensureSummary(sel,attestedTexts),0); }
    if(!summaryText){const w=this.wikiDef(sel);
      if(w&&w.text&&!w.none&&w.confirmed){summaryText=w.text;wikiBacked=true;wikiUrl=w.url;wikiTitle=w.title;wikiConf=true;}
      else{const gist=this.sourceGist(sel);if(gist){summaryText=gist;srcComposed=true;}
        if(!w&&(this.looksProperNoun(lab)||this.isGenericConcept(sel)))this.ensureWiki(sel);}}
    const synthN=attestedTexts.length;
    base.hasSel=true;base.showPrompt=false;base.autoOn=autoOn;
    if(this.state.panelSel&&g.entities.has(this.state.panelSel)){
      base.panelProfileOn=true;base.panelListOn=false;
      base.panelProfile=this.panelProfile(this.state.panelSel,this.state.viewUrl);
    } else if(this.state.previewWiki){base.previewOn=true;base.panelListOn=false;base.preview=this.previewVals();}
    base.ent={name:lab,hasSummary:!!summaryText,
      summary:summaryText||('No established summary yet — so far '+lab+' is mostly mentioned, not described. '+(autoOn?'Enriching without being asked…':'Read more to establish it.')),
      summaryStyle:summaryText?'':'color:var(--ink3);font-style:italic;',
      synthMark:wikiBacked?('✦ Wikipedia · '+wikiTitle+' — matched to your graph'):(srcComposed?'✦ composed from your sources — not yet an attested definition':(summaryText?('✦ stitched verbatim from '+synthN+' attested proposition'+(synthN!==1?'s':'')+' — every line traced below'):'✦ nothing attested to summarize yet — only appearances')),
      wikiBacked:wikiBacked,wikiUrl:wikiUrl,wikiTitle:wikiTitle,
      av:this.initials(lab),avStyle:this.avatar(lab,46),avStyleSm:this.avatar(lab,24),meta:{sightings:e.sightings||mentions.length}};
    base.aliases=aliases;

    // ── first person: the attributive record — who said what, when ───────
    // Replaces the "view from nowhere" summary. Every surfaced claim is a quote
    // worn in attributive grammar (S2 reports / asserts / names), carrying its
    // source and the date it was read. The folded sentence is demoted to a
    // marked, defeasible composition the app stands behind; absence is the
    // reflexive VOID — the edge of what the app has actually read.
    // Each register a distinct marker: reports (documented), asserts (intent/claim),
    // names (in passing). Glyph + color + label, kept visibly apart.
    const REGV={eva:{verb:'reports',fg:'#1d4ed8',bg:'#e8eefc',gl:'\u25A0'},def:{verb:'asserts',fg:'#b45309',bg:'#fbf0db',gl:'\u25C6'},held:{verb:'names',fg:'#6b7280',bg:'#eef0f3',gl:'\u25CB'}};
    const fmtDate=ts=>{try{return new Date(ts).toLocaleDateString([],{month:'short',day:'numeric'});}catch(e){return '';}};
    const fpRows=subjIdx.map(i=>{const b=this.bandOf(i),u=this.master.sentenceSource[i],p=this.pageOf(u),R=REGV[b]||REGV.held,ch=this.chip(u,active===u);
      return {sortw:b==='eva'?0:(b==='def'?1:2),verb:R.verb,glyph:R.gl,
        regStyle:'display:inline-flex;align-items:center;gap:5px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:'+R.fg+';background:'+R.bg+';border-radius:5px;padding:2px 8px;flex:0 0 auto;',
        srcId:this.srcId(u),host:this.short(u),when:p?fmtDate(p.ts):'',hasWhen:!!(p&&p.ts),
        txt:this.stripRefs(this.norm(this.master.sentences[i])),jumpUrl:this.tfURL(u,this.master.sentences[i]),
        onOpen:()=>this.openSource(u),onEnter:()=>this.setHover(u),onLeave:()=>this.setHover(null),chip:ch,
        rowStyle:'padding:10px 13px;border-top:1px solid var(--line);'+((active&&active!==u)?'opacity:.24;transition:opacity .14s;':'opacity:1;transition:opacity .14s;')};});
    fpRows.sort((a,b)=>a.sortw-b.sortw);
    const fpHas=fpRows.length>0;
    const provOpen=!!this.state.provOpen;
    // distinct register legend, shown so the markers read as a vocabulary
    const seenB={};subjIdx.forEach(i=>{seenB[this.bandOf(i)]=true;});
    const legend=['eva','def','held'].filter(b=>seenB[b]).map(b=>{const R=REGV[b];return {label:R.verb,glyph:R.gl,
      style:'display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;color:'+R.fg+';'};});
    base.fp={
      has:fpHas, empty:!fpHas, openHas:fpHas&&provOpen,
      open:provOpen, caret:provOpen?'\u25BE':'\u25B8',
      toggleLabel:provOpen?'hide provenance':'trace provenance',
      onToggle:()=>this.setState(s=>({provOpen:!s.provOpen})),
      legend:legend, hasLegend:legend.length>0,
      intro:'How I come to be saying the above — each line is a quote, traceable to who said it and when. The sentence above is my fold of these; if it goes past them, they win.',
      rows:fpRows.slice(0,8), hasMore:fpRows.length>8, more:Math.max(0,fpRows.length-8),
      voidNote:'I have not read anything that defines '+lab+'. It has been named, never described. This is the edge of what I have read — not a claim that nothing is there.'
    };

    base.egoViz=this.egoGraph(sel,nbrs,facets);base.hasEgo=(nbrs.length>0||facets.length>0);base.egoMeta=nbrs.length+' connected'+(facets.length?' · '+facets.length+' also-called':'');

    const enter=u=>()=>this.setHover(u),leave=()=>()=>this.setHover(null),openC=u=>()=>this.openSource(u);
    const dimOf=u=>(active&&active!==u)?'opacity:.24;transition:opacity .14s;':'opacity:1;transition:opacity .14s;';

    // bands
    const BANDM={eva:{name:'Attested',fg:'#1d4ed8',bg:'#e8eefc',note:'reported / documented'},def:{name:'Asserted',fg:'#b45309',bg:'#fbf0db',note:'intent / claim'},held:{name:'Mentioned',fg:'#6b7280',bg:'#eef0f3',note:'named in passing'}};
    const bands={eva:[],def:[],held:[]};subjIdx.forEach(i=>bands[this.bandOf(i)].push(i));
    const cE=bands.eva.length,cD=bands.def.length,cH=bands.held.length,tot=cE+cD+cH||1;
    let eL,eC;if(cE/tot>=.45){eL='well attested';eC='#1d4ed8';}else if(cD/tot>=.4){eL='mostly asserted';eC='#b45309';}else{eL='mostly mentioned';eC='#6b7280';}
    base.est={label:eL,labelStyle:'font-size:12.5px;font-weight:600;color:'+eC+';',dot:'width:8px;height:8px;border-radius:50%;background:'+eC+';display:inline-block;',
      segs:[[cE,'#1d4ed8'],[cD,'#b45309'],[cH,'#6b7280']].filter(([n])=>n>0).map(([n,c])=>({style:'width:'+(n/tot*100)+'%;background:'+c+';display:block;'}))};
    base.statList=[{k:'about',v:subjIdx.length},{k:'links',v:nbrs.length},{k:'sources',v:srcs.length}];
    base.bandSections=['eva','def','held'].filter(b=>bands[b].length).map(b=>({name:BANDM[b].name,note:BANDM[b].note,count:bands[b].length,
      pillStyle:'display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:600;color:'+BANDM[b].fg+';background:'+BANDM[b].bg+';border-radius:20px;padding:3px 10px;',pillDot:'width:7px;height:7px;border-radius:50%;background:'+BANDM[b].fg+';display:inline-block;',
      claims:bands[b].slice(0,12).map(i=>{const u=this.master.sentenceSource[i],ch=this.chip(u,active===u);return {txt:this.norm(this.master.sentences[i]),srcId:this.srcId(u),chipStyle:ch.style,dotStyle:ch.dot,onChip:openC(u),onEnter:enter(u),onLeave:leave(),jumpUrl:this.tfURL(u,this.master.sentences[i]),dim:dimOf(u)};})}));

    base.hasBandSections=base.bandSections.length>0;base.noBandSections=base.bandSections.length===0;
    base.apprClaims=apprIdx.slice(0,10).map(i=>{const u=this.master.sentenceSource[i],ch=this.chip(u,active===u);return {txt:this.norm(this.master.sentences[i]),srcId:this.srcId(u),chipStyle:ch.style,dotStyle:ch.dot,onChip:openC(u),onEnter:enter(u),onLeave:leave(),jumpUrl:this.tfURL(u,this.master.sentences[i]),dim:dimOf(u)};});
    base.hasAppr=apprIdx.length>0;base.apprCount=apprIdx.length;

    // relations
    const GRAINC={Ground:'#386a96',Figure:'#a3692c',Pattern:'#3c7a50'};
    const rels=nbrs.slice(0,14).map(n=>{const u=n.sent!=null?this.master.sentenceSource[n.sent]:null,ch=u?this.chip(u,active===u):null,olab=this.labelOf(n.id);
      const gr=n.grain||'Figure',gc=GRAINC[gr]||GRAINC.Figure;
      return {toLabel:olab,rel:this.relVerb(n.vias[0]||'related'),onClick:()=>this.clickEntity(n.id),onEnter2:ev=>this.entHover(n.id,ev),onLeave2:()=>this.entLeave(),
        grain:gr,llm:!!n.llm,grainTitle:'grain · '+gr+' (proposition embedded, verb dropped, tested against the band)',
        grainStyle:'display:inline-flex;align-items:center;gap:4px;font-size:9.5px;font-weight:600;color:'+gc+';background:'+gc+'14;border-radius:5px;padding:1px 6px;flex:0 0 auto;',grainDot:'width:5px;height:5px;border-radius:50%;background:'+gc+';display:inline-block;',
        countLabel:'',hasSrc:!!u,srcId:u?this.srcId(u):'',chipStyle:u?ch.style:'',dotStyle:u?ch.dot:'',onChip:u?openC(u):(()=>{}),onEnter:u?enter(u):(()=>{}),onLeave:leave(),dim:u?dimOf(u):'',av:this.initials(olab),avStyle:this.avatar(olab,28)};});
    base.relations=rels;base.relCount=nbrs.length;base.hasRelations=rels.length>0;

    // ── source chips on the panel: which sources feed this profile ──────
    // sources split: pages the reader intentionally opened are primary; pages EO
    // pulled in on its own (REAFFERENCE / self-enrich) sit behind a disclosure click.
    const chipOf=u=>{const ch=this.chip(u,active===u),p=this.pageOf(u);return {id:this.srcId(u),host:this.short(u),style:ch.style,dot:ch.dot,onChip:openC(u),onEnter:enter(u),onLeave:leave(),title:(p&&p.title)||u};};
    const learnedU=srcs.filter(u=>{const p=this.pageOf(u);return !!(p&&p.via==='REAFFERENCE');});
    const intentU=srcs.filter(u=>{const p=this.pageOf(u);return !(p&&p.via==='REAFFERENCE');});
    base.srcChips=intentU.map(chipOf);
    base.learnedChips=learnedU.map(chipOf);
    base.hasSrcChips=srcs.length>0;
    base.hasLearned=learnedU.length>0;
    const learnedOpen=!!this.state.learnedOpen;
    base.learnedOpenHas=base.hasLearned&&learnedOpen;
    base.learnedCaret=learnedOpen?'\u25BE':'\u25B8';
    base.learnedToggleLabel=(learnedOpen?'hide ':'+ ')+learnedU.length+' found on its own';
    base.onToggleLearned=()=>this.setState(s=>({learnedOpen:!s.learnedOpen}));
    base.srcChipsLabel=intentU.length?(intentU.length+(intentU.length===1?' source you opened':' sources you opened')):'self-learned only';

    // ── explicit research consent: EO no longer self-learns on its own. The user
    // decides whether to look further, and picks breadth or depth. ───────────
    const _lr=this.state.liveResearch||{},_researchingThis=!!(_lr.on&&_lr.focal===sel);
    base.askBusy=!!this._busy||_researchingThis;
    base.askIdle=!base.askBusy;
    base.askLabel=_researchingThis?('Researching '+lab+'…'):'Should I research more?';
    base.askSub=_researchingThis
      ?(_lr.phase==='read'?('Reading '+(_lr.host||'a new source')+'…'):('Searching the web for more on '+lab+'…'))
      :(srcs.length?('I won’t add sources on my own — '+srcs.length+' read so far. Widen out, or dig in.'):'I won’t add sources on my own — choose how to look.');
    base.onAskBreadth=()=>{this.setState({mode:'breadth'});this.research(sel,'breadth');};
    base.onAskDepth=()=>{this.setState({mode:'depth'});this.research(sel,'depth');};
    base.onAskResearch=()=>{this.research(sel,this.state.mode||'breadth');};

    // ── audit mode: integral fold vs. Wikipedia, + raw graph contents ───
    base.auditOn=this.state.auditMode;
    if(this.state.auditMode){
      const foldDef=this.summaryFallback(attestedTexts)||this.sourceGist(sel)||null;
      base.hasFoldDef=!!foldDef;base.noFoldDef=!foldDef;base.foldDef=foldDef||'';
      base.foldMeta=synthN+' attested proposition'+(synthN!==1?'s':'')+' · '+srcs.length+(srcs.length===1?' source':' sources');
      base.foldEmpty='“'+lab+'” is only named so far — no defining proposition to fold into a referent yet.';
      const w=this.wikiDef(sel),wikiText=(w&&w.text&&!w.none&&w.confirmed)?w.text:null;
      if(!w&&(this.looksProperNoun(lab)||this.isGenericConcept(sel)))this.ensureWiki(sel); // audit always wants the wiki referent to compare against
      base.hasWikiText=!!wikiText;base.wikiText=wikiText||'';base.wikiTitle=(w&&w.title)||'';base.wikiUrl=(w&&w.url)||'';
      base.wikiAbsent=!wikiText&&!!(w&&w.none);base.wikiWait=!wikiText&&!(w&&w.none);
      const cmp=(foldDef&&wikiText)?this.defCompare(foldDef,wikiText):null;
      base.hasCompare=!!cmp;
      if(cmp){
        const tagChip=c=>'display:inline-flex;align-items:center;font-size:11px;font-weight:600;color:'+c+';background:'+c+'14;border:1px solid '+c+'33;border-radius:6px;padding:1px 8px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;';
        base.cmpPct=cmp.pct+'%';
        base.cmpShared=cmp.shared.slice(0,14).map(t=>({t,style:tagChip('#15803d')}));base.cmpHasShared=cmp.shared.length>0;
        base.cmpFold=cmp.aOnly.slice(0,14).map(t=>({t,style:tagChip(_acc)}));base.cmpHasFold=cmp.aOnly.length>0;
        base.cmpWiki=cmp.bOnly.slice(0,14).map(t=>({t,style:tagChip('#2563eb')}));base.cmpHasWiki=cmp.bOnly.length>0;
      }
      const BMN={eva:'attested',def:'asserted',held:'mentioned'};
      const trip=this.entityTriples(sel);
      const auditObj={
        entity:{id:sel,label:lab,aliases:realAliases,also_called:facets,sightings:base.ent.meta.sightings,sources:srcs.map(u=>this.srcId(u)),links:nbrs.length},
        definition:{integral_fold:foldDef||null,fold_from:{attested_propositions:synthN,sources:srcs.length},wikipedia:wikiText||null,wikipedia_title:(w&&w.title)||null,referent_overlap:cmp?cmp.pct/100:null},
        propositions_as_subject:trip.subj,
        propositions_as_object:trip.obj,
        mentioned_in:{count:apprIdx.length,bands:apprIdx.reduce((m,i)=>{const b=BMN[this.bandOf(i)];m[b]=(m[b]||0)+1;return m;},{})}
      };
      base.auditText=JSON.stringify(auditObj,null,2);
      base.auditPropCount=trip.subj.length+trip.obj.length;
      base.auditExpanded=!this.state.auditCollapsed;
      base.auditCollapseLabel=this.state.auditCollapsed?'Show':'Hide';
      base.onToggleAuditCollapse=()=>this.setState(s=>({auditCollapsed:!s.auditCollapsed}));
      base.auditCopyLabel=this.state.auditCopied?'Copied ✓':'Copy';
      base.onCopyAudit=()=>{try{navigator.clipboard.writeText(base.auditText);}catch(e){}this.setState({auditCopied:true});clearTimeout(this._auditCopyT);this._auditCopyT=setTimeout(()=>this.setState({auditCopied:false}),1400);};
    }

    // voids
    const vds=this.graph.voids.filter(v=>v.node===sel);
    base.hasVoids=vds.length>0;base.voids=vds.map(v=>({txt:v.rel?('No '+v.rel):'Asserted absence',ctx:v.sentIdx!=null?this.norm(this.master.sentences[v.sentIdx]).slice(0,150):''}));

    // related media — only the sources that actually mention THIS entity
    const srcSet=new Set(srcs);
    base.media=this.master.pages.filter(p=>srcSet.has(p.url)).map(p=>{const c=this.hashColor(this.short(p.url)),thumb=p.image;
      const grad='linear-gradient(120deg,'+c+','+c+'bb)';
      return {title:p.title,host:this.short(p.url),meta:'read '+this.fmtTime(p.ts),url:p.url,glyph:(p.via==='REAFFERENCE'?'⟲':'¶'),noImg:!thumb,
        onEnter:enter(p.url),onLeave:leave(),onOpen:()=>this.openSource(p.url,true,'page'),
        thumbStyle:'position:relative;height:94px;border-radius:9px;border:1px solid var(--line);overflow:hidden;display:flex;align-items:center;justify-content:center;color:#fff;background:'+(thumb?("url('"+String(thumb).replace(/'/g,"%27")+"'), "+grad+";background-size:cover;background-position:center;"):(grad+";"))};});
    base.hasMedia=base.media.length>0;

    // ledger
    base.ledger=this.master.pages.map(p=>{const isA=active===p.url,c=this.hashColor(this.short(p.url)),cnt=this.master.sentenceSource.filter(u=>u===p.url).length;
      return {sid:this.srcId(p.url),label:p.title,host:this.short(p.url),read:this.fmtTime(p.ts),tstamp:'read '+new Date(p.ts).toLocaleString(),count:cnt,learnMark:p.via==='REAFFERENCE'?'⟲ ':'',
        dot:'width:10px;height:10px;border-radius:50%;background:'+c+';display:inline-block;flex-shrink:0;',onEnter:enter(p.url),onLeave:leave(),onOpen:openC(p.url),
        style:'border:1px solid '+(isA?c:'var(--line)')+';border-left:3px solid '+c+';border-radius:8px;padding:9px 11px;margin-bottom:8px;cursor:pointer;transition:all .12s;background:'+(isA?'#f7f9fc':'var(--card)')+';'};});

    // frontier
    const fr=this.frontier(sel);
    const FK={void:{fg:'#9a6b12',bar:'#d6a83a'},conflict:{fg:'#b91c1c',bar:'#dc2626'},deepen:{fg:'#1d4ed8',bar:'#1d4ed8'}};
    base.frontier=fr.map(it=>({kind:it.kind,label:it.label,tagStyle:'font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:'+FK[it.kind].fg+';background:'+FK[it.kind].fg+'14;border-radius:5px;padding:2px 6px;flex:0 0 auto;',barStyle:'width:'+Math.round(100*Math.min(1,it.score/3))+'%;background:'+FK[it.kind].bar+';display:block;',onFocus:()=>this.setState({direction:it.query})}));
    base.hasFrontier=fr.length>0;base.frontierQuiet=fr.length===0;

    // research controls
    const md=this.state.mode,segOn='font-size:12px;font-weight:600;color:var(--acc);background:var(--card);border:none;border-radius:7px;padding:6px 12px;box-shadow:0 1px 2px rgba(0,0,0,.06);',segOff='font-size:12px;font-weight:500;color:var(--ink2);background:transparent;border:none;border-radius:7px;padding:6px 12px;',busy=this.state.busy;
    base.breadthStyle=md==='breadth'?segOn:segOff;base.depthStyle=md==='depth'?segOn:segOff;base.onBreadth=()=>this.setState({mode:'breadth'});base.onDepth=()=>this.setState({mode:'depth'});
    base.modeHint=(busy?'Working…':'Research — searches and reads more sources.')+(this.state.direction.trim()&&!busy?'  ·  aimed at “'+this.state.direction.trim()+'”':'');
    base.onResearch=()=>this.research();base.researchLabel=busy?'Researching…':'Research';base.researchGlyph=busy?'◐':'✦';base.researchIcon='display:inline-block;margin-right:7px;'+(busy?'animation:eospin .9s linear infinite;':'');
    base.researchStyle='display:inline-flex;align-items:center;font-size:13px;font-weight:600;color:#fff;background:'+(busy?'#7ea3e8':'var(--acc)')+';border:none;border-radius:9px;padding:9px 16px;box-shadow:0 1px 2px rgba(37,99,235,.3);'+(busy?'cursor:default;':'');
    const FEED={search:{i:'⌕',c:'#2563eb'},found:{i:'≣',c:'#2563eb'},read:{i:'▤',c:'#b45309'},graph:{i:'＋',c:'#15803d'},done:{i:'✓',c:'#1b1f24'},warn:{i:'!',c:'#dc2626'}};
    base.feed=this.state.feed.filter(l=>l.ent==null||l.ent===sel).map(l=>l.sep?{isSep:true,isLine:false,text:l.sep}:{isLine:true,isSep:false,icon:(FEED[l.k]||{i:'·'}).i,icStyle:'flex:0 0 auto;width:15px;text-align:center;color:'+((FEED[l.k]||{c:'#9aa1ab'}).c)+';font-weight:700;',text:l.t,rowStyle:l.k==='done'?'font-weight:500;':''});
    base.hasFeed=base.feed.length>0;

    // hovercard
    this.hoverVals(base);

    // source panel
    if(this.state.openSrc&&this.pageOf(this.state.openSrc)){const url=this.state.openSrc,p=this.pageOf(url),c=this.hashColor(this.short(url));
      const idxs=[];this.master.sentenceSource.forEach((u,i)=>{if(u===url)idxs.push(i);});
      const tagColor={eva:'#1d4ed8',def:'#b45309',held:'#6b7280'},tagName={eva:'attested',def:'asserted',held:'mentioned'};
      const selMentions=new Set(this.mentionsOf(sel));
      const props=idxs.map(i=>{const b=this.bandOf(i),about=selMentions.has(i),txt=this.norm(this.master.sentences[i]);return {txt,body:this.linkifyNode(txt,url),tag:tagName[b],about,tagStyle:'font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:'+tagColor[b]+';',rowStyle:'padding:10px 0;border-bottom:1px solid #f0f1f3;'+(about?'background:linear-gradient(90deg,#eef3fc 0,transparent 60%);margin:0 -8px;padding-left:8px;padding-right:8px;border-radius:6px;':'')};});
      props.sort((a,b)=>(b.about?1:0)-(a.about?1:0));
      const wide=this.state.srcWide,isText=/^text:/i.test(url),tab=(this.state.srcTab||'page'),canEmbed=!isText,showPage=tab==='page'&&canEmbed,showProps=!showPage;
      const tabOn='font-size:12px;font-weight:600;color:var(--acc);background:var(--accbg);border:1px solid var(--accline);border-radius:8px;padding:5px 12px;cursor:pointer;',tabOff='font-size:12px;font-weight:500;color:var(--ink2);background:var(--card);border:1px solid var(--line2);border-radius:8px;padding:5px 12px;cursor:pointer;';
      let urlPath='';try{const _u=new URL(url);urlPath=(_u.pathname+_u.search)||'/';}catch(e){urlPath=isText?' reader text':'';}
      base.srcOpen=true;base.srcWide=wide;base.srcView={sid:this.srcId(url),label:p.title,host:this.short(url),urlPath,read:this.fmtTime(p.ts),url,dot:'width:11px;height:11px;border-radius:50%;background:'+c+';display:inline-block;flex:0 0 auto;',total:props.length,aboutCount:props.filter(x=>x.about).length,props,
        panelStyle:'position:absolute;top:0;right:0;bottom:0;width:'+(wide?'min(1180px,94vw)':'468px')+';max-width:96vw;background:var(--card);border-left:1px solid var(--line);box-shadow:-12px 0 44px rgba(0,0,0,.14);z-index:21;display:flex;flex-direction:column;animation:eoslide .18s ease-out;transition:width .2s ease;',
        canEmbed,showPage,showProps,loading:!!this.state.srcLoading&&!this.state.srcDoc,err:(this.state.srcErr&&!this.state.srcDoc)?this.state.srcErr:null,hasDoc:!!this.state.srcDoc,doc:this.state.srcDoc||'',
        pageTabStyle:showPage?tabOn:tabOff,propsTabStyle:showProps?tabOn:tabOff,onPage:()=>this.setSrcTab('page'),onProps:()=>this.setSrcTab('props'),
        onWide:()=>this.toggleWide(),wideIcon:wide?'⤡':'⤢',wideTitle:wide?'Read in brief':'Expand full width',onReload:()=>this.loadEmbed(url),
        linkMode:this.state.linkMode,onToggleLink:()=>this.toggleLinkMode(),
        linkBtnStyle:'display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;border-radius:8px;padding:5px 11px;cursor:pointer;'+(this.state.linkMode?'color:var(--acc);background:var(--accbg);border:1px solid var(--accline);':'color:var(--ink2);background:var(--card);border:1px solid var(--line2);')};}
    this.linkChoiceVals(base);

    base.footNote='Live projection of your reading log over the real eoreader4 engine. Each URL is fetched through your proxy, parsed into propositions, and folded into one append-only log; the graph — and every profile — re-projects from it at the latest cursor. Relations and bands are the engine’s raw output: candidates to check against the passage, not verdicts.';
    return base;
  }
}
