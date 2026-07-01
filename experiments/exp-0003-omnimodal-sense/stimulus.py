"""
An intense, modality-blind battery for the eoreader4 omnimodal sense.

Two families:
  A) MULTILINGUAL TEXT — the same "register recurrence + multiplicity" shape as the
     original sense demo, but across 11 scripts/languages (Latin, Cyrillic, Greek,
     Arabic, Hebrew, Han, Kana, Devanagari, Hangul) + a code-switching stream.
     Front-end is script-agnostic character n-gram hashing — no tokenizer, so the
     engine (not the front-end) is what has to find the boundaries.
  B) CANONICAL HARD PROBLEMS — pure synthetic vectors (no modality), each isolating
     one classical failure mode of spectral segmentation: near-degenerate
     multiplicity (two balls), pure noise (must abstain), a single reading (must not
     hallucinate a cut), gradual drift (no sharp boundary), adjacent recurrence (a
     boundary assignment-switching CANNOT see), rank-deficient/collinear input, a
     high-K many-reading stream, and a heavy anisotropic common-mode.

Every stream carries ground-truth boundaries + per-unit labels + a tolerance. The
runner (engine_run_battery.mjs) reads them with the REAL engine and scores.
"""
import numpy as np, json, hashlib, os

OUT = "battery"
os.makedirs(OUT, exist_ok=True)

def hash_ngrams(s, dim=128, n=3):
    v = np.zeros(dim)
    for i in range(len(s) - n + 1):
        h = int(hashlib.md5(s[i:i+n].encode("utf-8")).hexdigest(), 16) % dim
        v[h] += 1.0
    return v

def dump(name, modality, dim, units, boundaries, labels, names, tol, note=""):
    path = os.path.join(OUT, name)
    json.dump({"modality": modality, "dim": int(dim),
               "units": [list(map(float, u)) for u in units],
               "boundaries": list(map(int, boundaries)),
               "labels": list(map(int, labels)),
               "names": names, "tol": int(tol), "note": note}, open(path, "w"))
    print(f"{name:26s} T={len(units):4d} dim={dim:3d} blocks={len(boundaries)+1:2d} tol={tol} -> {path}")

# ======================================================================
# A) MULTILINGUAL TEXT  — real word lists per language, two registers each
#    so a stream has genuine sub-structure, recurrence, and a mixed block.
# ======================================================================
LANG = {
 "en": ("the of and to in that is it for was are with as on by an".split(),
        "moon silver river breath shadow ache bloom hush ember longing dusk petal frost".split(),
        "vector gradient matrix function parameter tensor optimize threshold converge density".split()),
 "es": ("el la de que y a en un los se con por para una del las".split(),
        "luna plata rio aliento sombra flor amanecer ocaso escarcha anhelo susurro".split(),
        "vector gradiente matriz funcion parametro umbral converger densidad operador".split()),
 "de": ("der die das und in den von zu mit sich auf ist im dem nicht".split(),
        "mond silber fluss atem schatten bluete daemmerung reif sehnsucht flustern".split(),
        "vektor gradient matrix funktion parameter schwelle konvergieren dichte operator".split()),
 "ru": ("и в не на что с по как это он но за от так же вы".split(),
        "луна серебро река дыхание тень цветок рассвет закат иней тоска шёпот".split(),
        "вектор градиент матрица функция параметр порог сходиться плотность оператор".split()),
 "el": ("και το της των με για από στο που δεν να θα σε τον την".split(),
        "φεγγάρι ασήμι ποτάμι ανάσα σκιά άνθος αυγή δύση πάχνη λαχτάρα ψίθυρος".split(),
        "διάνυσμα κλίση μήτρα συνάρτηση παράμετρος κατώφλι σύγκλιση πυκνότητα".split()),
 "ar": ("في من على إلى عن مع هذا التي كان قد ذلك هو هي ما لا".split(),
        "قمر فضة نهر نفس ظل زهرة فجر غروب صقيع شوق همس".split(),
        "متجه تدرج مصفوفة دالة معامل عتبة تقارب كثافة مؤثر".split()),
 "he": ("של את על אל עם זה היא הוא כי לא כן גם רק אבל".split(),
        "ירח כסף נהר נשימה צל פרח שחר שקיעה כפור געגוע לחישה".split(),
        "וקטור שיפוע מטריצה פונקציה פרמטר סף התכנסות צפיפות אופרטור".split()),
 "zh": (list("的一是不了在人有我他这中大来上国个到说"),
        list("月银河息影花晓暮霜念语夜梦静寒光"),
        list("向量梯度矩阵函数参数阈值收敛密度算子谱")),
 "ja": (list("のにはをがとてもだしかなでこそあれ"),
        list("月銀河息影花暁霜恋囁夜夢静寒光空"),
        list("行列関数勾配閾値収束密度演算子固有")),
 "hi": ("के में की है और से का को पर एक यह हैं ने भी कर".split(),
        "चाँद चांदी नदी साँस छाया फूल भोर सांझ पाला तड़प फुसफुसाहट".split(),
        "सदिश ढाल आव्यूह फलन प्राचल देहली अभिसरण घनत्व संकारक".split()),
 "ko": ("의 이 가 을 를 에 는 은 로 와 과 도 만 하고 에서".split(),
        list("달 은 강 숨 그림자 꽃 새벽 노을 서리 그리움 속삭임".split()),
        "벡터 기울기 행렬 함수 매개변수 임계값 수렴 밀도 연산자".split()),
}


def make_sentence(rng, func, content):
    L = int(rng.integers(6, 16)); out = []
    for _ in range(L):
        out.append(str(rng.choice(func)) if rng.random() < 0.5 else str(rng.choice(content)))
    joiner = "" if not any(" " in w for w in func) and len(func[0]) <= 2 else " "
    # heuristics: CJK lists are single chars -> join with no space; else space
    return joiner.join(out)

def gen_lang(code, seed):
    rng = np.random.default_rng(seed)
    func, regA, regB = LANG[code]
    space = " " if any(len(w) > 2 for w in func) else ""
    def sent(reg):
        L = int(rng.integers(6, 16))
        out = [str(rng.choice(func)) if rng.random() < 0.5 else str(rng.choice(reg)) for _ in range(L)]
        return space.join(out)
    def mix():  # multiplicity: two registers simultaneously (the two-balls case)
        L = int(rng.integers(8, 18))
        out = [str(rng.choice(regA if rng.random() < 0.5 else regB)) for _ in range(L)]
        return space.join(out)
    # A, B, A(recurrence), MIX(multiplicity), B(recurrence)
    order = [("A", regA), ("B", regB), ("A", regA), ("MIX", None), ("B", regB)]
    lab = {"A": 0, "B": 1, "MIX": 2}
    units, labels, bounds = [], [], []
    for bi, (tag, reg) in enumerate(order):
        if bi: bounds.append(len(units))
        for _ in range(int(rng.integers(18, 26))):
            s = mix() if tag == "MIX" else sent(reg)
            units.append(hash_ngrams(s)); labels.append(lab[tag])
    dump(f"text_{code}.json", f"text:{code}", 128, units, bounds, labels,
         {0: "regA", 1: "regB", 2: "mix"}, tol=2, note=f"multilingual {code}")

for i, code in enumerate(LANG):
    gen_lang(code, 100 + i)

# code-switching: alternate WHOLE LANGUAGES as the readings
def gen_codeswitch():
    rng = np.random.default_rng(77)
    seq = ["en", "zh", "ar", "ru", "en", "hi", "zh"]  # en & zh recur
    uniq = sorted(set(seq)); nmap = {c: i for i, c in enumerate(uniq)}
    units, labels, bounds = [], [], []
    for bi, code in enumerate(seq):
        if bi: bounds.append(len(units))
        func, regA, regB = LANG[code]; space = " " if any(len(w) > 2 for w in func) else ""
        for _ in range(int(rng.integers(16, 24))):
            L = int(rng.integers(6, 14))
            pool = func + regA + regB
            s = space.join(str(rng.choice(pool)) for _ in range(L))
            units.append(hash_ngrams(s)); labels.append(nmap[code])
    dump("text_codeswitch.json", "text:codeswitch", 128, units, bounds, labels,
         {i: c for c, i in nmap.items()}, tol=2, note="whole-language code switching")
gen_codeswitch()

# ======================================================================
# B) CANONICAL HARD PROBLEMS — pure vectors, one failure mode each.
# ======================================================================
def orthobasis(dim, k, seed):
    rng = np.random.default_rng(seed)
    A = rng.standard_normal((dim, k)); Q, _ = np.linalg.qr(A)
    return [Q[:, i] for i in range(k)]

def emit(dim, blocks, seed, jitter=0.15):
    """blocks = [(label, direction, count)] -> noisy unit vectors around each dir."""
    rng = np.random.default_rng(seed)
    units, labels, bounds = [], [], []
    for bi, (lab, d, cnt) in enumerate(blocks):
        if bi: bounds.append(len(units))
        for _ in range(cnt):
            v = d + jitter * rng.standard_normal(dim)
            units.append(v); labels.append(lab)
    return units, labels, bounds

def gen_two_balls():  # near-degenerate multiplicity: two readings ~equal Born weight
    dim = 40; b = orthobasis(dim, 2, 1)
    blocks = [(0, b[0], 30), (1, b[1], 30), (0, b[0], 25), (1, b[1], 25)]
    u, l, bd = emit(dim, blocks, 11, jitter=0.35)  # heavy jitter -> near-degenerate spectrum
    dump("hard_two_balls.json", "hard:degenerate", dim, u, bd, l, {0: "ballA", 1: "ballB"}, tol=3,
         note="two near-equal readings; eigenvalues nearly tied")

def gen_pure_noise():  # must ABSTAIN — no reading clears the void
    rng = np.random.default_rng(22); dim = 40; T = 160
    u = [rng.standard_normal(dim) for _ in range(T)]
    dump("hard_pure_noise.json", "hard:noise", dim, u, [], [0] * T, {0: "noise"}, tol=3,
         note="isotropic gaussian; ground truth = NO boundaries, engine should abstain")

def gen_single_reading():  # one block -> must not hallucinate a cut (precision=1 target)
    dim = 40; b = orthobasis(dim, 1, 3)
    u, l, bd = emit(dim, [(0, b[0], 140)], 33, jitter=0.2)
    dump("hard_single.json", "hard:single", dim, u, bd, l, {0: "one"}, tol=3,
         note="a single stationary reading; any detected boundary is a false positive")

def gen_gradual_drift():  # slow rotation: NO sharp boundary
    rng = np.random.default_rng(44); dim = 40; T = 140
    b = orthobasis(dim, 2, 4); a, c = b
    u, l = [], []
    for t in range(T):
        th = (np.pi / 2) * t / (T - 1)
        d = np.cos(th) * a + np.sin(th) * c
        u.append(d + 0.15 * rng.standard_normal(dim)); l.append(0 if t < T // 2 else 1)
    dump("hard_drift.json", "hard:drift", dim, u, [T // 2], l, {0: "early", 1: "late"}, tol=6,
         note="continuous rotation; there is no true sharp boundary (F1 expected low, honestly)")

def gen_adjacent_recurrence():  # a boundary assignment-switching cannot see
    dim = 40; b = orthobasis(dim, 2, 5)
    # A | A | B : the first cut is A->A (same reading both sides) -> invisible to switching
    blocks = [(0, b[0], 40), (0, b[0], 40), (1, b[1], 40)]
    u, l, bd = emit(dim, blocks, 55, jitter=0.2)
    dump("hard_adjacent_recurrence.json", "hard:recurrence", dim, u, bd, l,
         {0: "A", 1: "B"}, tol=3, note="cut #1 is A|A (invisible to lens-switching), cut #2 is A|B")

def gen_collinear():  # rank-deficient: all units near one axis
    rng = np.random.default_rng(66); dim = 40; b = orthobasis(dim, 1, 6)[0]
    u = [b + 0.03 * rng.standard_normal(dim) for _ in range(120)]
    dump("hard_collinear.json", "hard:rankdef", dim, u, [], [0] * 120, {0: "line"}, tol=3,
         note="near rank-1; density nearly pure; no boundaries")

def gen_high_k():  # many distinct readings -> K selection under pressure
    dim = 48; b = orthobasis(dim, 8, 7)
    blocks = [(i, b[i], 20) for i in range(8)]
    u, l, bd = emit(dim, blocks, 77, jitter=0.2)
    dump("hard_high_k.json", "hard:highK", dim, u, bd, l, {i: f"r{i}" for i in range(8)}, tol=3,
         note="8 orthogonal readings in sequence; tests reading-count selection")

def gen_common_mode():  # a huge shared DC + small structure -> centering test
    rng = np.random.default_rng(88); dim = 40
    dc = np.ones(dim) / np.sqrt(dim) * 6.0     # dominant common mode
    b = orthobasis(dim, 3, 8)
    blocks = [(0, b[0], 40), (1, b[1], 40), (2, b[2], 40)]
    u, l, bd = emit(dim, blocks, 99, jitter=0.2)
    u = [x + dc for x in u]                     # bury structure under DC
    dump("hard_common_mode.json", "hard:commonmode", dim, u, bd, l,
         {0: "a", 1: "b", 2: "c"}, tol=3, note="structure buried under a 6x common mode; centering must recover it")

for g in (gen_two_balls, gen_pure_noise, gen_single_reading, gen_gradual_drift,
          gen_adjacent_recurrence, gen_collinear, gen_high_k, gen_common_mode):
    g()

print("battery generated.")
