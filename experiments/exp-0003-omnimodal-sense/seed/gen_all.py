"""
Four sensory front-ends -> per-unit feature vectors + ground truth.
The front-ends are the caller's job (spectral.js: 'the basis is the load-bearing
choice'). The ENGINE that reads them is the real eoreader4 machinery (run in Node).
Each stream has: recurrence (readings that return), a multiplicity segment (two
simultaneous sources, the two-balls case), and known segment boundaries.
"""
import numpy as np, json, hashlib

def hash_ngrams(s, dim=96, n=3):
    v = np.zeros(dim); s = s.lower()
    for i in range(len(s) - n + 1):
        h = int(hashlib.md5(s[i:i+n].encode()).hexdigest(), 16) % dim
        v[h] += 1.0
    return v

def dump(path, modality, dim, units, boundaries, labels, names, tol):
    json.dump({"modality": modality, "dim": int(dim),
               "units": [list(map(float, u)) for u in units],
               "boundaries": list(map(int, boundaries)),
               "labels": list(map(int, labels)),
               "names": names, "tol": int(tol)}, open(path, "w"))
    print(f"{modality:14s} T={len(units):4d} dim={dim:3d} blocks={len(boundaries)+1} -> {path}")

# ======================= 1. TEXT (long, multi-register) =======================
def gen_text():
    rng = np.random.default_rng(1)
    func = ['the','a','of','and','to','in','that','is','it','for','with','as','on','by','an','was','are']
    R = {
      'legal':    dict(w=['pursuant','herein','party','agreement','shall','provision','liability','whereas','notwithstanding','obligation','clause','terminate','indemnify','jurisdiction','covenant','remedy'], lo=16, hi=30, end=['.',';'], comma=0.4),
      'poetic':   dict(w=['moon','silver','river','breath','shadow','ache','bloom','hush','ember','tide','longing','dusk','petal','echo','frost','marrow'], lo=8, hi=16, end=['.','—','...'], comma=0.5),
      'technical':dict(w=['vector','gradient','matrix','function','parameter','tensor','optimize','algorithm','threshold','converge','eigenvalue','density','operator','boundary','spectral','manifold'], lo=12, hi=22, end=['.'], comma=0.3),
      'casual':   dict(w=['yeah','honestly','like','kinda','wanna','okay','whatever','guess','stuff','gonna','maybe','cool','seriously','totally','anyway','stuff'], lo=5, hi=12, end=['.','?','!','...'], comma=0.2),
      'news':     dict(w=['official','according','reported','statement','tuesday','spokesperson','announced','following','authorities','investigation','committee','budget','council','ordinance','deferred','filing'], lo=14, hi=26, end=['.'], comma=0.35),
    }
    def sentence(reg):
        r = R[reg]; L = int(rng.integers(r['lo'], r['hi'])); out = []
        for _ in range(L):
            out.append(rng.choice(func) if rng.random() < 0.55 else rng.choice(r['w']))
            if rng.random() < r['comma'] * 0.15 and out: out[-1] += ','
        s = ' '.join(out); s = s[0].upper() + s[1:]
        return s.rstrip(',') + rng.choice(r['end'])
    order = ['legal','poetic','technical','legal','casual','news','technical','poetic']  # recurrence
    names = {i: n for i, n in enumerate(sorted(R))}; inv = {n: i for i, n in names.items()}
    units, labels, bounds = [], [], []
    for bi, reg in enumerate(order):
        if bi: bounds.append(len(units))
        for _ in range(int(rng.integers(24, 32))):
            units.append(hash_ngrams(sentence(reg))); labels.append(inv[reg])
    dump("text_units.json", "text", 96, units, bounds, labels, names, tol=1)

# ======================= 2. AUDIO (tones/chords/mixture/noise) =================
def gen_audio():
    sr = 16000; rng = np.random.default_rng(2)
    def tone(f, n): t = np.arange(n)/sr; return np.sin(2*np.pi*f*t)
    segs = [  # (label_name, signal_fn, seconds)
      ('A220', lambda n: tone(220,n), 0.8),
      ('B440', lambda n: tone(440,n), 0.8),
      ('MIX',  lambda n: 0.6*tone(220,n)+0.6*tone(659,n), 0.9),   # two simultaneous sources
      ('NOISE',lambda n: rng.standard_normal(n), 0.6),
      ('B440', lambda n: tone(440,n), 0.7),                        # recurrence
      ('CHORD',lambda n: 0.5*(tone(330,n)+tone(415,n)+tone(494,n)), 0.9),
      ('A220', lambda n: tone(220,n), 0.7),                        # recurrence
    ]
    names_list, sig, seg_bounds_samp = [], [], []
    for nm, fn, dur in segs:
        n = int(dur*sr); seg_bounds_samp.append(len(sig)); s = fn(n)
        s = s/(np.max(np.abs(s))+1e-9) + 0.02*rng.standard_normal(n)
        sig.extend(s); names_list.append(nm)
    sig = np.array(sig)
    # framing + 32 log-mel-ish bands
    win, hop, nb = 400, 160, 32
    fbins = np.fft.rfftfreq(win, 1/sr)
    edges = np.logspace(np.log10(60), np.log10(sr/2), nb+1)
    band_idx = [np.where((fbins>=edges[b]) & (fbins<edges[b+1]))[0] for b in range(nb)]
    frames, centers = [], []
    for start in range(0, len(sig)-win, hop):
        w = sig[start:start+win]*np.hanning(win)
        mag = np.abs(np.fft.rfft(w))
        band = np.array([mag[ix].sum() if len(ix) else 0.0 for ix in band_idx])
        frames.append(np.log1p(band)); centers.append(start+win//2)
    centers = np.array(centers)
    # segment boundaries -> frame indices; per-frame labels
    uniq = sorted(set(names_list)); nmap = {n:i for i,n in enumerate(uniq)}
    seg_bounds_samp.append(len(sig))
    labels, bounds = [], []
    for fi, c in enumerate(centers):
        seg = np.searchsorted(seg_bounds_samp, c, side='right')-1
        labels.append(nmap[names_list[min(seg, len(names_list)-1)]])
    for b in seg_bounds_samp[1:-1]:
        bounds.append(int(np.searchsorted(centers, b)))
    dump("audio_units.json", "audio", 32, frames, bounds, labels, {i:n for n,i in nmap.items()}, tol=4)

# ======================= 3. VISION (textures + moving blob) ====================
def gen_vision():
    rng = np.random.default_rng(3); H = 48
    xx, yy = np.meshgrid(np.linspace(0,1,H), np.linspace(0,1,H))
    def horiz():  return 0.5+0.5*np.sin(2*np.pi*6*yy)
    def vert():   return 0.5+0.5*np.sin(2*np.pi*6*xx)
    def check():  return ((np.floor(xx*8)+np.floor(yy*8))%2).astype(float)
    def blob(cx,cy): return np.exp(-(((xx-cx)**2+(yy-cy)**2)/0.01))
    # texture-sensitive descriptor: 8-bin gradient-orientation histogram (mag-weighted)
    # + 4 radial spatial-frequency energies from the 2D FFT. Distinguishes orientation
    # and scale — which avg-pooling destroys.
    def descriptor(img):
        gy, gx = np.gradient(img)
        mag = np.hypot(gx, gy); ang = (np.arctan2(gy, gx) % np.pi)          # 0..pi
        oh, _ = np.histogram(ang, bins=8, range=(0, np.pi), weights=mag)
        F = np.abs(np.fft.fftshift(np.fft.fft2(img - img.mean())))
        cy0, cx0 = H//2, H//2
        ry, rx = np.meshgrid(np.arange(H)-cy0, np.arange(H)-cx0, indexing='ij')
        rad = np.hypot(rx, ry); redges = np.linspace(0, H/2, 5)
        rf = np.array([F[(rad>=redges[b]) & (rad<redges[b+1])].mean() for b in range(4)])
        return np.concatenate([oh/(oh.sum()+1e-9), rf/(rf.sum()+1e-9)])       # 12-dim, scale-free
    scenes = [('HORIZ',10),('VERT',10),('HORIZ',8),('BLOB',14),('VERT',9),('CHECK',10),('HORIZ',8)]  # recurrence
    uniq = sorted(set(s for s,_ in scenes)); nmap={n:i for i,n in enumerate(uniq)}
    frames, labels, bounds = [], [], []
    for si,(nm,cnt) in enumerate(scenes):
        if si: bounds.append(len(frames))
        for k in range(cnt):
            if nm=='HORIZ': img=horiz()
            elif nm=='VERT': img=vert()
            elif nm=='CHECK': img=check()
            else: img=blob(0.15+0.7*k/cnt, 0.5)   # blob moves across (dynamic scene)
            img = img + 0.05*rng.standard_normal((H,H))
            frames.append(descriptor(img)); labels.append(nmap[nm])
    dump("vision_units.json", "vision", frames[0].shape[0], frames, bounds, labels, {i:n for n,i in nmap.items()}, tol=2)

# ======================= 4. PROPRIOCEPTION (IMU activities) ====================
def gen_imu():
    sr = 50; rng = np.random.default_rng(4)
    def still(n): return 0.05*rng.standard_normal((n,3))
    def walk(n):
        t=np.arange(n)/sr; base=np.zeros((n,3))
        base[:,0]=np.sin(2*np.pi*2*t); base[:,2]=0.7*np.sin(2*np.pi*2*t+1)
        return base+0.1*rng.standard_normal((n,3))
    def shake(n):
        t=np.arange(n)/sr; base=1.5*np.sin(2*np.pi*7*t)[:,None]*np.ones((1,3))
        return base+0.2*rng.standard_normal((n,3))
    acts=[('STILL',3.0),('WALK',3.0),('SHAKE',2.5),('WALK',3.0),('STILL',2.5),('WALK',3.0)]  # recurrence
    uniq=sorted(set(a for a,_ in acts)); nmap={n:i for i,n in enumerate(uniq)}
    sig=[]; seg_bounds=[]; names_seq=[]
    for a,dur in acts:
        n=int(dur*sr); seg_bounds.append(len(sig))
        fn={'STILL':still,'WALK':walk,'SHAKE':shake}[a]
        sig.extend(fn(n)); names_seq.append(a)
    sig=np.array(sig); seg_bounds.append(len(sig))
    win,hop=50,25; feats=[]; centers=[]
    for s in range(0,len(sig)-win,hop):
        w=sig[s:s+win]
        rms=np.sqrt((w**2).mean(axis=0))
        dom=[np.argmax(np.abs(np.fft.rfft(w[:,ax]-w[:,ax].mean()))) for ax in range(3)]
        feats.append(np.concatenate([rms, np.array(dom)/win, [np.sqrt((w**2).mean())]]))
        centers.append(s+win//2)
    centers=np.array(centers); labels=[]; bounds=[]
    for c in centers:
        seg=np.searchsorted(seg_bounds,c,side='right')-1
        labels.append(nmap[names_seq[min(seg,len(names_seq)-1)]])
    for b in seg_bounds[1:-1]:
        bounds.append(int(np.searchsorted(centers,b)))
    dump("imu_units.json","imu",7,feats,bounds,labels,{i:n for n,i in nmap.items()},tol=2)

gen_text(); gen_audio(); gen_vision(); gen_imu()
print("done.")
