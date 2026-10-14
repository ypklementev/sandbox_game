(() => {
    // ENGINE START
    const W = 256, H = 160, N = W * H;
    const AW = W >> 1, AH = H >> 1, AN = AW * AH;          // air grid: one cell per 2×2 particles
    const K_EMPTY = 0, K_SOLID = 1, K_POWDER = 2, K_LIQUID = 3, K_GAS = 4, K_FIRE = 5;
    const AMBIENT = 20;

    // k: id key, n: name, kind, dens: density, disp: liquid spread per tick, flam: contact ignition chance,
    // ign: ignition temperature, cond: heat conductivity, t0: spawn temperature, elec: conducts sparks,
    // str: pressure needed to break, brk: what it breaks into, cat: menu group
    const DEFS = [
        { k: 'EMPTY', n: 'Воздух', kind: K_EMPTY, cond: .015, c: ['#16130f'] },
        { k: 'WALL', n: 'Стена', kind: K_SOLID, cond: .02, cat: 'solid', c: ['#6b6560', '#625c57', '#736d68', '#5d5853'], d: 'Неподвижная, держит любое давление и плохо проводит тепло. Её съедает только Пустота.' },
        { k: 'SAND', n: 'Песок', kind: K_POWDER, dens: 150, cond: .03, cat: 'powder', c: ['#e3c27b', '#d8b56c', '#ecce8b', '#cfa95f'], d: 'Сыпется горками и тонет в жидкостях. Выше 1000 °C плавится в стекло.' },
        { k: 'WATER', n: 'Вода', kind: K_LIQUID, dens: 100, disp: 5, cond: .1, elec: 1, cat: 'liquid', c: ['#2f6fd6', '#3577de', '#2b67cc', '#3a7fe6'], d: 'Кипит при 100 °C, а под давлением позже, как в скороварке. Замерзает ниже 0 °C. Проводит ток, от искры разлагается на горючий газ. Растворяет соль, превращает землю в грязь, ржавит металл.' },
        { k: 'STONE', n: 'Камень', kind: K_POWDER, dens: 200, cond: .06, cat: 'powder', c: ['#8a8580', '#7d7873', '#96918b', '#74706b'], d: 'Тяжёлый, тонет во всём. Остывшая лава. Выше 1100 °C снова плавится.' },
        { k: 'LAVA', n: 'Лава', kind: K_LIQUID, dens: 180, disp: 2, cond: .1, t0: 1200, cat: 'liquid', c: ['#ff5a1a', '#ff7a22', '#e8401a', '#ff9a30'], d: '1200 °C, вязкая. Ниже 750 °C застывает в камень. Кипятит воду, поджигает горючее, плавит песок в стекло.' },
        { k: 'FIRE', n: 'Огонь', kind: K_FIRE, cond: .1, t0: 1000, cat: 'gas', c: ['#ff8a20'], d: 'Горячий и короткоживущий, поднимается вверх и греет воздух. В замкнутом объёме поднимает давление.' },
        { k: 'SMOKE', n: 'Дым', kind: K_GAS, cond: .03, cat: 'gas', c: ['#4a4643', '#55504c', '#3f3b39', '#5e5955'], blend: .65, d: 'На открытом воздухе рассеивается и уходит вверх. В закрытом сосуде остаётся и держит давление, пока не остынет.' },
        { k: 'STEAM', n: 'Пар', kind: K_GAS, cond: .05, t0: 110, cat: 'gas', c: ['#c7d3df', '#b8c6d4', '#d4dee8', '#aebdcc'], blend: .55, d: 'Поднимается и, остыв, конденсируется в воду. В герметичном сосуде копится, греется от стенок и поднимает давление.' },
        { k: 'WOOD', n: 'Дерево', kind: K_SOLID, flam: .02, ign: 300, cond: .01, str: 10, brk: 'SAWDUST', cat: 'solid', c: ['#7a4a26', '#6b3f20', '#85532c', '#5f381c'], d: 'Загорается от огня или выше 300 °C и долго тлеет углями. Взрывом разбивается в опилки.' },
        { k: 'PLANT', n: 'Растение', kind: K_SOLID, flam: .05, ign: 200, cond: .02, str: 4, brk: 'EMPTY', cat: 'solid', c: ['#3f9a3a', '#4aa844', '#368a32', '#56b84d'], d: 'Растёт, выпивая воду и вытягивая её из грязи. Хорошо горит.' },
        { k: 'OIL', n: 'Масло', kind: K_LIQUID, dens: 80, disp: 4, flam: .25, ign: 230, cond: .05, cat: 'liquid', c: ['#3b2a1a', '#44301e', '#332415', '#4d3722'], d: 'Легче воды, всплывает. Горит долго, вспыхивает выше 230 °C.' },
        { k: 'SALT', n: 'Соль', kind: K_POWDER, dens: 140, cond: .03, cat: 'powder', c: ['#f2f0ea', '#e6e3dc', '#fbfaf6', '#dcd8d0'], d: 'Растворяется в воде, делая её солёной.' },
        { k: 'SALTWATER', n: 'Солёная вода', kind: K_LIQUID, dens: 110, disp: 5, cond: .1, elec: 1, cat: 'liquid', c: ['#3f86c9', '#4690d2', '#3a7cbd', '#4d99db'], d: 'Тяжелее пресной, замерзает только ниже −21 °C и топит лёд. Хорошо проводит ток, быстро ржавит металл. При кипении оставляет соль.' },
        { k: 'ICE', n: 'Лёд', kind: K_SOLID, cond: .08, t0: -30, str: 6, brk: 'SNOW', cat: 'solid', c: ['#a8dcf0', '#bde6f5', '#9ad3eb', '#cbeef9'], d: '−30 °C. Охлаждает соседей и тает выше 0 °C. От удара давлением крошится в снег.' },
        { k: 'SNOW', n: 'Снег', kind: K_POWDER, dens: 60, cond: .03, t0: -10, cat: 'powder', c: ['#f4f8fb', '#e8eef3', '#ffffff', '#dfe7ee'], d: 'Лёгкий, медленно падает и плавает на воде. Тает выше 0 °C.' },
        { k: 'ACID', n: 'Кислота', kind: K_LIQUID, dens: 105, disp: 4, cond: .08, cat: 'liquid', c: ['#8bf03a', '#7ee02f', '#9bff4a', '#74d02a'], d: 'Разъедает почти всё, расходуясь и дымя. Не трогает стекло и стены.' },
        { k: 'GUNPOWDER', n: 'Порох', kind: K_POWDER, dens: 130, flam: 1, ign: 180, cond: .03, cat: 'powder', c: ['#3d3d42', '#4a4a50', '#333338', '#57575e'], d: 'Сгорает мгновенно и выделяет газы. На открытом месте вспыхивает, в закрытом сосуде давление рвёт стенки.' },
        { k: 'METAL', n: 'Металл', kind: K_SOLID, cond: .24, elec: 1, str: 60, brk: 'EMPTY', cat: 'solid', c: ['#a9b0b8', '#9aa1a9', '#b6bdc5', '#8e959d'], d: 'Лучший проводник тепла и тока, выдерживает почти любой взрыв. Искра в металле греет его и поджигает горючее рядом.' },
        { k: 'RUST', n: 'Ржавчина', kind: K_SOLID, cond: .05, str: 5, brk: 'ASH', cat: 'solid', c: ['#a4532a', '#94492a', '#b45f30', '#8a4224'], d: 'Получается из металла в воде. Хрупкая и ток не проводит.' },
        { k: 'GLASS', n: 'Стекло', kind: K_SOLID, cond: .03, str: 3, brk: 'SAND', cat: 'solid', c: ['#cfe8e4', '#c2ddd8', '#dbf0ec', '#b6d4cf'], blend: .55, d: 'Кислотоупорное, но хрупкое: от давления бьётся в песок. Удобно для сосудов, которые должны лопнуть.' },
        { k: 'DIRT', n: 'Земля', kind: K_POWDER, dens: 145, cond: .03, cat: 'powder', c: ['#6e4b2e', '#634327', '#7a5535', '#5a3d24'], d: 'С водой становится грязью.' },
        { k: 'MUD', n: 'Грязь', kind: K_POWDER, dens: 160, cond: .05, cat: 'powder', c: ['#4f3a28', '#483424', '#57402d', '#42301f'], d: 'Мокрая земля. Высыхает выше 100 °C. Растения вытягивают из неё воду.' },
        { k: 'NITRO', n: 'Нитро', kind: K_LIQUID, dens: 120, disp: 3, flam: 1, ign: 150, cond: .05, cat: 'liquid', c: ['#d9e86a', '#cfe05c', '#e2f07a', '#c4d550'], d: 'Жидкая взрывчатка. Взрывается от огня, жара выше 150 °C или ударной волны. Рвёт даже металл.' },
        { k: 'CLONE', n: 'Клон', kind: K_SOLID, cond: .02, cat: 'special', c: ['#d9b23a', '#c9a12c', '#e6c34d', '#b8932a'], d: 'Запоминает первое вещество, которое его коснётся, и бесконечно его производит. Получается кран для воды, лавы, песка.' },
        { k: 'VOID', n: 'Пустота', kind: K_SOLID, cond: 0, cat: 'special', c: ['#2a1838', '#341d45', '#22132e', '#3d2350'], d: 'Уничтожает всё, что к ней прикасается, включая стены.' },
        { k: 'GAS', n: 'Газ', kind: K_GAS, flam: 1, ign: 400, cond: .03, cat: 'gas', c: ['#8fae7a', '#9cbb86', '#83a16f', '#a3c48c'], blend: .4, d: 'Горючий газ, медленно расползается. От искры, огня или жара выше 400 °C вспыхивает всем облаком.' },
        { k: 'EMBER', n: 'Угли', kind: K_SOLID, cond: .05, t0: 700, cat: 'gas', c: ['#ff6a1a', '#c2410c', '#ffa640', '#7a2a10'], d: 'Тлеющее дерево, 700 °C. Долго выпускает огонь, потом рассыпается пеплом.' },
        { k: 'ASH', n: 'Пепел', kind: K_POWDER, dens: 50, cond: .02, cat: 'powder', c: ['#8b8682', '#7a7672', '#9a9591', '#6c6865'], d: 'Лёгкий, падает медленно и плавает на воде.' },
        { k: 'SAWDUST', n: 'Опилки', kind: K_POWDER, dens: 70, flam: .1, ign: 220, cond: .015, cat: 'powder', c: ['#c9a06a', '#bd935d', '#d6ad78', '#b08552'], d: 'Лёгкие и горючие. Получаются, когда взрыв разбивает дерево.' },
        { k: 'HEATER', n: 'Нагреватель', kind: K_SOLID, cond: .2, t0: 1500, cat: 'special', c: ['#c23b2b', '#d24a33', '#b33325', '#e05a3c'], d: 'Всегда держит 1500 °C. Подложи под сосуд, чтобы кипятить, плавить и поджигать.' },
        { k: 'COOLER', n: 'Охладитель', kind: K_SOLID, cond: .2, t0: -150, cat: 'special', c: ['#2b6fc2', '#3a7fd2', '#2462b3', '#4a8de0'], d: 'Всегда держит −150 °C. Замораживает воду, конденсирует пар, гасит жар.' },
        { k: 'BATTERY', n: 'Батарея', kind: K_SOLID, cond: .05, cat: 'special', c: ['#3a3f45', '#e8c547', '#3a3f45', '#2f3439'], d: 'Источник тока. Пускает искры в соседний металл или воду, они бегут по проводнику волной.' },
    ];
    const T = {}; DEFS.forEach((d, i) => { d.id = i; T[d.k] = i; });
    const { EMPTY, WALL, SAND, WATER, STONE, LAVA, FIRE, SMOKE, STEAM, WOOD, PLANT, OIL, SALT, SALTWATER, ICE, SNOW, ACID, GUNPOWDER, METAL, RUST, GLASS, DIRT, MUD, NITRO, CLONE, VOID, GAS, EMBER, ASH, SAWDUST, HEATER, COOLER, BATTERY } = T;
    const ERASER = 255;

    const NT = DEFS.length;
    const kind = new Uint8Array(NT), dens = new Uint8Array(NT), disp = new Uint8Array(NT);
    const flam = new Float32Array(NT), ign = new Float32Array(NT), cond = new Float32Array(NT), t0 = new Float32Array(NT);
    const elec = new Uint8Array(NT), str = new Float32Array(NT), brk = new Uint8Array(NT), thr = new Float32Array(NT);
    DEFS.forEach(d => {
        const i = d.id;
        kind[i] = d.kind; dens[i] = d.dens || 0; disp[i] = d.disp || 0; flam[i] = d.flam || 0; ign[i] = d.ign || 0;
        cond[i] = d.cond || 0; t0[i] = d.t0 ?? AMBIENT; elec[i] = d.elec || 0; str[i] = d.str || 0; brk[i] = d.brk ? T[d.brk] : 0;
        // how hard the air has to blow to move this particle
        thr[i] = d.kind === K_GAS ? .08 : d.kind === K_FIRE ? .1 : d.kind === K_LIQUID ? .45 : d.kind === K_POWDER ? .3 + (d.dens || 0) / 160 : 1e9;
    });

    // ---------- World state ----------
    const type = new Uint8Array(N), life = new Uint8Array(N), shade = new Uint8Array(N), clk = new Uint8Array(N);
    const temp = new Float32Array(N).fill(AMBIENT);
    let chg = new Uint8Array(N), chg2 = new Uint8Array(N);          // spark state: 2 head, 1 tail, 0 idle
    let P = new Float32Array(AN), P2 = new Float32Array(AN);
    const VX = new Float32Array(AN), VY = new Float32Array(AN), blk = new Uint8Array(AN);
    // sealed cavities: per-cell static pressure from the gas they contain (ideal gas: amount × absolute temperature / free volume)
    const reg = new Int32Array(N), cellP = new Float32Array(N), prevP = new Float32Array(N), cellOpen = new Uint8Array(N);
    const stack = new Int32Array(N), rSum = new Float64Array(N), rV = new Int32Array(N), rOpen = new Uint8Array(N);
    let frame = 1, tick = 0;
    const rnd = Math.random;

    // for gases, life holds the amount of gas packed into the cell (1 + life/8 cells' worth of air)
    function lifeInit(t) {
        if (t === FIRE) return 15 + (rnd() * 30 | 0);
        if (t === EMBER) return 80 + (rnd() * 120 | 0);
        if (kind[t] === K_GAS) return 8;
        return 0;
    }
    // convert a cell, keeping its current temperature (energy stays put)
    function setc(i, t) { type[i] = t; life[i] = lifeInit(t); shade[i] = rnd() * 256 | 0; clk[i] = frame; }
    // spawn a fresh particle at its natural temperature
    function spawn(i, t) { setc(i, t); temp[i] = t0[t]; }
    function swap(a, b) {
        let t = type[a]; type[a] = type[b]; type[b] = t;
        t = life[a]; life[a] = life[b]; life[b] = t;
        t = shade[a]; shade[a] = shade[b]; shade[b] = t;
        const q = temp[a]; temp[a] = temp[b]; temp[b] = q;
        clk[a] = frame; clk[b] = frame;
    }
    const DX = [-1, 0, 1, -1, 1, -1, 0, 1], DY = [-1, -1, -1, 0, 0, 1, 1, 1];
    function rn(x, y) {
        const d = rnd() * 8 | 0, nx = x + DX[d], ny = y + DY[d];
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) return -1;
        return ny * W + nx;
    }
    function canDisp(t, nt) {
        if (nt === EMPTY) return true;
        const kn = kind[nt];
        if (kn === K_GAS || kn === K_FIRE) return true;
        if (kn === K_LIQUID) return dens[t] > dens[nt];
        return false;
    }

    // ---------- Air pressure ----------
    function addP(x, y, a) {
        const bx = x >> 1, by = y >> 1, b = by * AW + bx;
        if (!blk[b]) { P[b] += a; return; }
        const nb = [];
        if (bx > 0 && !blk[b - 1]) nb.push(b - 1);
        if (bx < AW - 1 && !blk[b + 1]) nb.push(b + 1);
        if (by > 0 && !blk[b - AW]) nb.push(b - AW);
        if (by < AH - 1 && !blk[b + AW]) nb.push(b + AW);
        for (const k of nb) P[k] += a / nb.length;
    }
    // flood-fill every cavity; cavities touching the top or side edges are open atmosphere (pressure 0)
    function regionStep() {
        prevP.set(cellP);
        reg.fill(-1);
        let R = 0;
        for (let s = 0; s < N; s++) {
            if (reg[s] !== -1 || kind[type[s]] === K_SOLID) continue;
            let sp = 0, sum = 0, V = 0, open = 0;
            stack[sp++] = s; reg[s] = R;
            while (sp) {
                const i = stack[--sp], t = type[i], k = kind[t], x = i % W, y = i / W | 0;
                if (k === K_EMPTY || k === K_GAS || k === K_FIRE) {
                    V++;
                    sum += (k === K_GAS ? 1 + life[i] / 8 : 1) * (temp[i] + 273) / 293;
                }
                if (y === 0 || x === 0 || x === W - 1) open = 1;
                if (x > 0 && reg[i - 1] === -1 && kind[type[i - 1]] !== K_SOLID) { reg[i - 1] = R; stack[sp++] = i - 1; }
                if (x < W - 1 && reg[i + 1] === -1 && kind[type[i + 1]] !== K_SOLID) { reg[i + 1] = R; stack[sp++] = i + 1; }
                if (y > 0 && reg[i - W] === -1 && kind[type[i - W]] !== K_SOLID) { reg[i - W] = R; stack[sp++] = i - W; }
                if (y < H - 1 && reg[i + W] === -1 && kind[type[i + W]] !== K_SOLID) { reg[i + W] = R; stack[sp++] = i + W; }
            }
            rSum[R] = sum; rV[R] = V; rOpen[R] = open; R++;
        }
        for (let i = 0; i < N; i++) {
            const r = reg[i];
            if (r < 0) { cellP[i] = 0; cellOpen[i] = 0; continue; }
            cellOpen[i] = rOpen[r];
            let p = 0;
            if (!rOpen[r] && rV[r] > 0) { p = rSum[r] / rV[r] - 1; p = p > 200 ? 200 : p < -1 ? -1 : p; }
            else if (!rOpen[r]) p = prevP[i];        // no free volume left: keep what was there
            cellP[i] = p;
            // a sealed cavity just burst open: its stored pressure leaves as a blast wave
            if (rOpen[r] && prevP[i] > 0.5) addP(i % W, i / W | 0, prevP[i] * 0.3);
        }
    }
    // pressure difference a solid cell has to hold back
    function wallLoad(x, y) {
        const i = y * W + x;
        let m = maxP(x, y), v;
        if (x > 0 && (v = Math.abs(cellP[i - 1])) > m) m = v;
        if (x < W - 1 && (v = Math.abs(cellP[i + 1])) > m) m = v;
        if (y > 0 && (v = Math.abs(cellP[i - W])) > m) m = v;
        if (y < H - 1 && (v = Math.abs(cellP[i + W])) > m) m = v;
        return m;
    }
    // strongest pressure acting on a cell from the surrounding open air
    function maxP(x, y) {
        const bx = x >> 1, by = y >> 1, b = by * AW + bx;
        let m = Math.abs(P[b]), v;
        if (bx > 0 && (v = Math.abs(P[b - 1])) > m) m = v;
        if (bx < AW - 1 && (v = Math.abs(P[b + 1])) > m) m = v;
        if (by > 0 && (v = Math.abs(P[b - AW])) > m) m = v;
        if (by < AH - 1 && (v = Math.abs(P[b + AW])) > m) m = v;
        return m;
    }
    function airStep() {
        blk.fill(0);
        for (let y = 0; y < H; y++) {
            const row = y * W, brow = (y >> 1) * AW;
            for (let x = 0; x < W; x++) if (kind[type[row + x]] === K_SOLID) blk[brow + (x >> 1)] = 1;
        }
        const k = 0.3;
        // velocity follows the pressure gradient; edges are open sky except the floor
        for (let by = 0; by < AH; by++) for (let bx = 0; bx < AW; bx++) {
            const i = by * AW + bx;
            if (blk[i]) { VX[i] = 0; VY[i] = 0; P[i] = 0; continue; }
            const p = P[i];
            const pl = bx > 0 ? (blk[i - 1] ? p : P[i - 1]) : 0;
            const pr = bx < AW - 1 ? (blk[i + 1] ? p : P[i + 1]) : 0;
            const pu = by > 0 ? (blk[i - AW] ? p : P[i - AW]) : 0;
            const pd = by < AH - 1 ? (blk[i + AW] ? p : P[i + AW]) : p;
            let vx = (VX[i] + (pl - pr) * k) * 0.97, vy = (VY[i] + (pu - pd) * k) * 0.97;
            if (vx > 0 && bx < AW - 1 && blk[i + 1]) vx = 0;
            if (vx < 0 && bx > 0 && blk[i - 1]) vx = 0;
            if (vy > 0 && (by === AH - 1 || blk[i + AW])) vy = 0;
            if (vy < 0 && by > 0 && blk[i - AW]) vy = 0;
            VX[i] = vx > 30 ? 30 : vx < -30 ? -30 : vx;
            VY[i] = vy > 30 ? 30 : vy < -30 ? -30 : vy;
        }
        // pressure drops where air flows out, plus a little smoothing
        for (let by = 0; by < AH; by++) for (let bx = 0; bx < AW; bx++) {
            const i = by * AW + bx;
            if (blk[i]) { P2[i] = 0; continue; }
            const p = P[i];
            const vl = bx > 0 ? (blk[i - 1] ? 0 : VX[i - 1]) : VX[i];
            const vr = bx < AW - 1 ? (blk[i + 1] ? 0 : VX[i + 1]) : VX[i];
            const vu = by > 0 ? (blk[i - AW] ? 0 : VY[i - AW]) : VY[i];
            const vd = by < AH - 1 ? (blk[i + AW] ? 0 : VY[i + AW]) : 0;
            const pl = bx > 0 ? (blk[i - 1] ? p : P[i - 1]) : 0;
            const pr = bx < AW - 1 ? (blk[i + 1] ? p : P[i + 1]) : 0;
            const pu = by > 0 ? (blk[i - AW] ? p : P[i - AW]) : 0;
            const pd = by < AH - 1 ? (blk[i + AW] ? p : P[i + AW]) : p;
            let np = p - (vr - vl + vd - vu) * 0.5 * k;
            np += ((pl + pr + pu + pd) * 0.25 - p) * 0.15;
            np *= 0.995;
            P2[i] = np > 200 ? 200 : np < -200 ? -200 : np;
        }
        const s = P; P = P2; P2 = s;
    }
    // wind and blast waves carry loose particles
    function airPush(i, x, y, t) {
        const b = (y >> 1) * AW + (x >> 1), vx = VX[b], vy = VY[b];
        const ax = vx < 0 ? -vx : vx, ay = vy < 0 ? -vy : vy, sp = ax + ay, th = thr[t];
        if (sp <= th || rnd() > (sp - th) * 0.6) return false;
        let dx = 0, dy = 0;
        if (rnd() * sp < ax) dx = vx > 0 ? 1 : -1; else dy = vy > 0 ? 1 : -1;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) {
            if (kind[t] === K_GAS || kind[t] === K_FIRE) { type[i] = EMPTY; return true; }
            return false;
        }
        const n = ny * W + nx, nt = type[n];
        if (nt === EMPTY || ((kind[nt] === K_GAS || kind[nt] === K_FIRE) && kind[t] !== K_GAS)) { swap(i, n); return true; }
        return false;
    }

    // ---------- Combustion ----------
    function blast(cx, cy, r, p) {
        const r2 = r * r + r;
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
            if (dx * dx + dy * dy > r2) continue;
            const x = cx + dx, y = cy + dy;
            if (x < 0 || y < 0 || x >= W || y >= H) continue;
            const i = y * W + x, t = type[i];
            if (t === EMPTY || kind[t] === K_GAS) { setc(i, FIRE); temp[i] = 1600; }
            else if (kind[t] !== K_SOLID || t === EMBER) temp[i] = Math.max(temp[i], 600);
        }
        const c = cy * W + cx; setc(c, FIRE); temp[c] = 1600;
        addP(cx, cy, p);
    }
    function ignite(n) {
        const t = type[n], x = n % W, y = n / W | 0;
        // explosives turn into a lot of very hot gas packed into one cell; it expands into any free room
        if (t === GUNPOWDER) { blast(x, y, 1, 1.5); setc(n, SMOKE); life[n] = 120; temp[n] = 1500; return; }
        if (t === NITRO) { blast(x, y, 2, 18); setc(n, SMOKE); life[n] = 160; temp[n] = 2000; return; }
        if (t === GAS) { blast(x, y, 1, 1.2); return; }
        if (t === WOOD) { setc(n, EMBER); life[n] = 80 + (rnd() * 120 | 0); }
        else if (t === PLANT) { setc(n, EMBER); life[n] = 15 + (rnd() * 25 | 0); }
        else if (t === OIL) { setc(n, FIRE); life[n] = 40 + (rnd() * 40 | 0); }
        else if (t === SAWDUST) { setc(n, FIRE); life[n] = 30 + (rnd() * 30 | 0); }
        else setc(n, FIRE);
        if (temp[n] < 800) temp[n] = 800;
    }

    // ---------- Movement ----------
    function powder(i, x, y, t) {
        if (y + 1 >= H) return;
        if ((t === SNOW || t === ASH || t === SAWDUST) && rnd() < 0.45) return;
        const b = i + W;
        if (canDisp(t, type[b])) { swap(i, b); return; }
        const l = x > 0 ? b - 1 : -1, r = x < W - 1 ? b + 1 : -1;
        const f = rnd() < 0.5, a = f ? l : r, c = f ? r : l;
        if (a >= 0 && canDisp(t, type[a])) { swap(i, a); return; }
        if (c >= 0 && canDisp(t, type[c])) { swap(i, c); return; }
    }
    function side(i, x, t, dir) {
        const d = disp[t]; let best = -1;
        for (let k = 1; k <= d; k++) {
            const nx = x + dir * k; if (nx < 0 || nx >= W) break;
            const n = i + dir * k, nt = type[n];
            if (nt === EMPTY || kind[nt] === K_GAS) best = n;
            else if (kind[nt] === K_LIQUID && dens[nt] < dens[t]) best = n;
            else break;
        }
        return best;
    }
    function liquid(i, x, y, t) {
        if (y + 1 < H) {
            const b = i + W;
            if (canDisp(t, type[b])) { swap(i, b); return; }
            const l = x > 0 ? b - 1 : -1, r = x < W - 1 ? b + 1 : -1;
            const f = rnd() < 0.5, a = f ? l : r, c = f ? r : l;
            if (a >= 0 && canDisp(t, type[a])) { swap(i, a); return; }
            if (c >= 0 && canDisp(t, type[c])) { swap(i, c); return; }
        }
        const dir = rnd() < 0.5 ? -1 : 1;
        let n = side(i, x, t, dir); if (n < 0) n = side(i, x, t, -dir);
        if (n >= 0) swap(i, n);
    }
    function gas(i, x, y, t) {
        // gases leave through the open top edge; in a sealed cavity they are conserved
        if (y === 0 && rnd() < 0.04) { type[i] = EMPTY; return; }
        // densely packed gas expands into neighbouring free space, splitting its amount
        if (life[i] >= 8 && rnd() < 0.3) {
            const n = rn(x, y);
            if (n >= 0 && type[n] === EMPTY) { const h = life[i] >> 1; life[i] -= h; setc(n, t); life[n] = h; temp[n] = temp[i]; return; }
        }
        // in the open atmosphere smoke and steam thin out
        if (cellOpen[i] && t !== GAS) {
            if (life[i] > 0 && rnd() < 0.2) life[i]--;
            else if (t === SMOKE && life[i] === 0 && rnd() < 0.004) { type[i] = EMPTY; return; }
        }
        if (t === GAS) {
            const n = rn(x, y);
            if (n >= 0 && type[n] === EMPTY && (n < i || rnd() < 0.45)) swap(i, n);
            return;
        }
        if (y > 0 && rnd() < 0.75) {
            const d = (rnd() * 3 | 0) - 1, nx = x + d;
            if (nx >= 0 && nx < W) { const n = i - W + d; if (type[n] === EMPTY) { swap(i, n); return; } }
        }
        const d = rnd() < 0.5 ? -1 : 1, nx = x + d;
        if (nx >= 0 && nx < W && type[i + d] === EMPTY) swap(i, i + d);
    }

    // ---------- Per-particle rules ----------
    function update(i, x, y, t) {
        const Tc = temp[i];
        if (ign[t] && Tc > ign[t] && rnd() < 0.1) { ignite(i); return; }
        const k = kind[t];
        if (k === K_SOLID) {
            if (str[t] && rnd() < 0.25 && wallLoad(x, y) > str[t]) {
                const b = brk[t]; if (b) setc(i, b); else type[i] = EMPTY;
                return;
            }
        }
        let n, nt;
        switch (t) {
            case WALL: case WOOD: case METAL: case RUST: case GLASS: case BATTERY: return;
            case HEATER: temp[i] = 1500; return;
            case COOLER: temp[i] = -150; return;

            case FIRE: {
                const l = life[i];
                if (l <= 1) { if (rnd() < 0.25) setc(i, SMOKE); else type[i] = EMPTY; return; }
                life[i] = l - 1;
                if (temp[i] < 1000) temp[i] = 1000;
                for (let q = 0; q < 2; q++) {
                    n = rn(x, y); if (n < 0) continue; nt = type[n];
                    if (flam[nt] > 0 && rnd() < flam[nt]) ignite(n);
                    else if ((nt === WATER || nt === SALTWATER) && rnd() < 0.3) { type[i] = EMPTY; return; }
                }
                if (airPush(i, x, y, t)) return;
                if (rnd() < 0.6 && y > 0) {
                    const d = (rnd() * 3 | 0) - 1, nx = x + d;
                    if (nx >= 0 && nx < W) { n = i - W + d; if (type[n] === EMPTY) swap(i, n); }
                }
                return;
            }

            case EMBER: {
                const l = life[i];
                if (l <= 1) { if (rnd() < 0.6) setc(i, ASH); else type[i] = EMPTY; return; }
                life[i] = l - 1;
                if (temp[i] < 700) temp[i] = 700;
                n = rn(x, y); if (n < 0) return; nt = type[n];
                if (nt === EMPTY) { if (n < i && rnd() < 0.35) { setc(n, FIRE); life[n] = 8 + (rnd() * 15 | 0); temp[n] = 1000; } }
                else if (flam[nt] > 0 && rnd() < flam[nt] * 2) ignite(n);
                else if (nt === WATER || nt === SALTWATER) life[i] = Math.max(1, l - 30);
                return;
            }

            case ICE: {
                if (Tc > 0 && rnd() < 0.05) { setc(i, WATER); temp[i] = 1; }
                return;
            }

            case PLANT: {
                if (rnd() < 0.03) {
                    n = rn(x, y);
                    if (n >= 0) {
                        nt = type[n];
                        if (nt === WATER && rnd() < 0.5) setc(n, PLANT);
                        else if (nt === MUD && rnd() < 0.3) {
                            setc(n, DIRT);
                            const d = (rnd() * 3 | 0) - 1, nx = x + d;
                            if (y > 0 && nx >= 0 && nx < W && type[i - W + d] === EMPTY) setc(i - W + d, PLANT);
                        }
                    }
                }
                return;
            }

            case CLONE: {
                if (life[i] === 0) {
                    n = rn(x, y);
                    if (n >= 0) { nt = type[n]; if (nt !== EMPTY && nt !== CLONE && nt !== VOID && nt !== WALL && nt !== ERASER) life[i] = nt; }
                } else if (rnd() < 0.4) {
                    n = rn(x, y);
                    if (n >= 0 && type[n] === EMPTY) spawn(n, life[i]);
                }
                return;
            }

            case VOID: {
                n = rn(x, y);
                if (n >= 0) { nt = type[n]; if (nt !== EMPTY && nt !== VOID && nt !== CLONE) { type[n] = EMPTY; temp[n] = AMBIENT; } }
                return;
            }

            // ----- powders -----
            case SAND: if (Tc > 1000 && rnd() < 0.01) { setc(i, GLASS); return; } break;
            case STONE: if (Tc > 1100 && rnd() < 0.02) { setc(i, LAVA); return; } break;
            case SNOW: if (Tc > 0 && rnd() < 0.03) { setc(i, WATER); temp[i] = 1; return; } break;
            case MUD: if (Tc > 100 && rnd() < 0.02) { setc(i, DIRT); return; } break;

            // ----- liquids -----
            case WATER: {
                // boiling point rises with pressure, like in a pressure cooker
                const bp = 100 + 20 * Math.max(0, cellP[i]);
                if (Tc > bp && rnd() < 0.2) { setc(i, STEAM); life[i] = 32; temp[i] = bp + (Tc - bp) * 0.5 + 2; return; }
                if (Tc < 0 && rnd() < 0.05) { setc(i, ICE); temp[i] = -1; return; }
                if (rnd() < 0.12) {
                    n = rn(x, y);
                    if (n >= 0) {
                        nt = type[n];
                        if (nt === SALT) { type[n] = EMPTY; setc(i, SALTWATER); return; }
                        if (nt === DIRT && rnd() < 0.3) { setc(n, MUD); type[i] = EMPTY; return; }
                        if (nt === METAL && rnd() < 0.01) setc(n, RUST);
                    }
                }
                break;
            }
            case SALTWATER: {
                const bp = 105 + 20 * Math.max(0, cellP[i]);
                if (Tc > bp && rnd() < 0.2) { if (rnd() < 0.35) setc(i, SALT); else { setc(i, STEAM); life[i] = 32; } temp[i] = bp + 2; return; }
                if (Tc < -21 && rnd() < 0.05) { setc(i, ICE); return; }
                if (rnd() < 0.12) {
                    n = rn(x, y);
                    if (n >= 0) {
                        nt = type[n];
                        if (nt === METAL && rnd() < 0.04) setc(n, RUST);
                        else if ((nt === ICE || nt === SNOW) && rnd() < 0.2) setc(n, WATER);
                    }
                }
                break;
            }
            case LAVA: {
                if (Tc < 750 && rnd() < 0.05) { setc(i, STONE); return; }
                n = rn(x, y);
                if (n >= 0) {
                    nt = type[n];
                    if (flam[nt] > 0) ignite(n);
                    else if (nt === EMPTY && n < i && rnd() < 0.004) { setc(n, FIRE); life[n] = 5 + (rnd() * 10 | 0); }
                }
                if (rnd() > 0.3) return;   // viscous
                break;
            }
            case ACID: {
                if (Tc > 300 && rnd() < 0.05) { setc(i, SMOKE); return; }
                if (rnd() < 0.2) {
                    n = rn(x, y);
                    if (n >= 0) {
                        nt = type[n];
                        const kn = kind[nt];
                        if (nt !== EMPTY && nt !== WALL && nt !== GLASS && nt !== ACID && nt !== CLONE && nt !== VOID && kn !== K_GAS && kn !== K_FIRE) {
                            setc(n, rnd() < 0.3 ? SMOKE : EMPTY); if (type[n] === EMPTY) temp[n] = Math.max(temp[n], AMBIENT);
                            if (rnd() < 0.25) { setc(i, rnd() < 0.5 ? SMOKE : EMPTY); return; }
                        }
                    }
                }
                break;
            }
            case NITRO: if (rnd() < 0.2 && maxP(x, y) > 8) { ignite(i); return; } break;

            // ----- gases -----
            case STEAM: {
                const bp = 100 + 20 * Math.max(0, cellP[i]);
                if (Tc < bp - 3 && rnd() < 0.01) {
                    if (rnd() < Math.max(0.15, life[i] / 32)) { setc(i, WATER); } else type[i] = EMPTY;
                    return;
                }
                break;
            }
        }

        if (airPush(i, x, y, t)) return;
        if (k === K_POWDER) powder(i, x, y, t);
        else if (k === K_LIQUID) liquid(i, x, y, t);
        else if (k === K_GAS) gas(i, x, y, t);
    }

    // ---------- Heat ----------
    function heatStep() {
        for (let y = 0; y < H; y++) {
            const row = y * W;
            for (let x = 0; x < W; x++) {
                const i = row + x, a = cond[type[i]];
                if (x < W - 1) {
                    const j = i + 1, b = cond[type[j]], k = a < b ? a : b;
                    if (k > 0) { const d = (temp[j] - temp[i]) * k; temp[i] += d; temp[j] -= d; }
                }
                if (y < H - 1) {
                    const j = i + W, b = cond[type[j]], k = a < b ? a : b;
                    if (k > 0) { const d = (temp[j] - temp[i]) * k; temp[i] += d; temp[j] -= d; }
                }
                // only open air is cooled by the surrounding atmosphere; a sealed cavity keeps its heat
                if (type[i] === EMPTY && cellOpen[i]) temp[i] += (AMBIENT - temp[i]) * 0.02;
            }
        }
    }

    // ---------- Electricity (Wireworld-style waves) ----------
    function elecStep() {
        for (let y = 0; y < H; y++) {
            const row = y * W;
            for (let x = 0; x < W; x++) {
                const i = row + x, t = type[i];
                if (!elec[t]) { chg2[i] = 0; continue; }
                const c = chg[i];
                if (c === 2) { chg2[i] = 1; continue; }
                if (c === 1) { chg2[i] = 0; continue; }
                let hot = 0;
                for (let d = 0; d < 8 && !hot; d++) {
                    const nx = x + DX[d], ny = y + DY[d];
                    if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
                    const n = ny * W + nx;
                    if (chg[n] === 2 || type[n] === BATTERY) hot = 1;
                }
                chg2[i] = hot ? 2 : 0;
            }
        }
        const s = chg; chg = chg2; chg2 = s;
        // effects of a passing spark
        for (let i = 0; i < N; i++) {
            if (chg[i] !== 2) continue;
            const t = type[i], x = i % W, y = i / W | 0;
            if (t === METAL) {
                temp[i] += 6;
                const n = rn(x, y);
                if (n >= 0 && flam[type[n]] > 0 && rnd() < 0.3) ignite(n);
            } else if (t === WATER || t === SALTWATER) {
                temp[i] += 0.5;
                if (rnd() < (t === SALTWATER ? 0.004 : 0.002)) { setc(i, GAS); chg[i] = 0; }
                else { const n = rn(x, y); if (n >= 0 && flam[type[n]] > 0 && type[n] !== OIL && rnd() < 0.1) ignite(n); }
            }
        }
    }

    function step() {
        frame = (frame + 1) & 255; if (frame === 0) frame = 1;
        tick++;
        airStep();
        regionStep();
        elecStep();
        for (let y = H - 1; y >= 0; y--) {
            const ltr = ((y + tick) & 1) === 0, row = y * W;
            for (let q = 0; q < W; q++) {
                const x = ltr ? q : W - 1 - q, i = row + x, t = type[i];
                if (t === EMPTY || clk[i] === frame) continue;
                update(i, x, y, t);
            }
        }
        heatStep();
    }

    // ---------- Scenes ----------
    function clearAll() { type.fill(0); life.fill(0); temp.fill(AMBIENT); chg.fill(0); chg2.fill(0); P.fill(0); P2.fill(0); VX.fill(0); VY.fill(0); cellP.fill(0); prevP.fill(0); cellOpen.fill(0); }
    function rect(x0, y0, x1, y1, t, p = 1) {
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++)
            if (x >= 0 && y >= 0 && x < W && y < H && rnd() < p) spawn(y * W + x, t);
    }
    function demo() {
        clearAll();
        // basin: water under a layer of oil
        rect(10, 100, 13, 159, WALL); rect(84, 100, 87, 159, WALL);
        rect(14, 124, 83, 159, WATER); rect(14, 115, 83, 123, OIL);
        // sealed glass box of gunpowder with a wire leading in
        rect(98, 124, 132, 125, GLASS); rect(98, 126, 99, 159, GLASS); rect(131, 126, 132, 159, GLASS);
        rect(100, 132, 130, 159, GUNPOWDER);
        rect(146, 150, 151, 159, BATTERY);
        rect(148, 112, 148, 149, METAL);                  // up from the battery
        rect(115, 112, 136, 112, METAL);                  // across, with a gap at 137..140
        rect(141, 112, 148, 112, METAL);
        rect(115, 113, 115, 131, METAL);                  // down through the lid into the powder
        // small dune
        for (let x = 158; x <= 196; x++) {
            const h = 16 - Math.abs(x - 177) * .8;
            for (let k = 0; k < h; k++) { const y = H - 1 - k; if (k < h - 2 || rnd() < .5) spawn(y * W + x, SAND); }
        }
        // ice block with snow on top
        rect(202, 138, 226, 159, ICE); rect(202, 134, 226, 137, SNOW, .8);
        // metal cup of lava kept molten by a heater underneath
        rect(186, 56, 188, 74, METAL); rect(230, 56, 232, 74, METAL); rect(186, 72, 232, 74, METAL);
        rect(189, 60, 229, 71, LAVA);
        rect(186, 75, 232, 76, HEATER);
        // tree
        rect(239, 116, 242, 159, WOOD);
        for (let dy = -12; dy <= 12; dy++) for (let dx = -12; dx <= 12; dx++)
            if (dx * dx + dy * dy < 140 && rnd() < .9) { const x = 240 + dx, y = 108 + dy; if (x < W && type[y * W + x] === EMPTY) spawn(y * W + x, PLANT); }
        // cloud of gas
        for (let k = 0; k < 220; k++) { const x = 24 + (rnd() * 50 | 0), y = 20 + (rnd() * 16 | 0); spawn(y * W + x, GAS); }
    }

    // ---------- Save format: RLE types + RLE temperatures (10° steps) + clone memories, base64 ----------
    function encode() {
        const out = [];
        const push = b => out.push(b & 255);
        push(3);
        let i = 0;
        while (i < N) { const t = type[i]; let c = 1; while (i + c < N && type[i + c] === t && c < 255) c++; push(c); push(t); i += c; }
        const q = j => Math.max(-3000, Math.min(3000, Math.round(temp[j] / 10)));
        i = 0;
        while (i < N) { const v = q(i); let c = 1; while (i + c < N && q(i + c) === v && c < 255) c++; const u = v + 32768; push(c); push(u >> 8); push(u); i += c; }
        // gas amounts (and other per-cell counters)
        i = 0;
        while (i < N) { const v = life[i]; let c = 1; while (i + c < N && life[i + c] === v && c < 255) c++; push(c); push(v); i += c; }
        const cl = []; for (let j = 0; j < N; j++) if (type[j] === CLONE && life[j]) cl.push(j);
        push(cl.length >> 8); push(cl.length);
        for (const j of cl) { push(j >> 8); push(j); push(life[j]); }
        let s = '';
        for (let k = 0; k < out.length; k += 8192) s += String.fromCharCode.apply(null, out.slice(k, k + 8192));
        return btoa(s);
    }
    function decode(str) {
        const bin = atob(str.trim());
        const b = new Uint8Array(bin.length);
        for (let k = 0; k < bin.length; k++) b[k] = bin.charCodeAt(k);
        let p = 0;
        const rd = () => { if (p >= b.length) throw new Error('short'); return b[p++]; };
        const ver = rd();
        if (ver !== 2 && ver !== 3) throw new Error('version');
        const nt = new Uint8Array(N), ntemp = new Float32Array(N), nlife = new Uint8Array(N);
        let i = 0;
        while (i < N) { const c = rd(), t = rd(); if (!c || i + c > N) throw new Error('rle'); nt.fill(t < NT ? t : 0, i, i + c); i += c; }
        i = 0;
        while (i < N) { const c = rd(), v = ((rd() << 8) | rd()) - 32768; if (!c || i + c > N) throw new Error('rle'); ntemp.fill(v * 10, i, i + c); i += c; }
        if (ver === 3) { i = 0; while (i < N) { const c = rd(), v = rd(); if (!c || i + c > N) throw new Error('rle'); nlife.fill(v, i, i + c); i += c; } }
        const n = (rd() << 8) | rd();
        const mem = [];
        for (let k = 0; k < n; k++) { const j = (rd() << 8) | rd(), m = rd(); if (j < N) mem.push([j, m < NT ? m : 0]); }
        clearAll();
        for (let j = 0; j < N; j++) { if (nt[j]) { setc(j, nt[j]); clk[j] = 0; if (ver === 3) life[j] = nlife[j]; } temp[j] = ntemp[j]; }
        for (const [j, m] of mem) if (type[j] === CLONE) life[j] = m;
    }
    // ENGINE END

    // ---------- Rendering ----------
    const hexRGB = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const BG = hexRGB('#16130f');
    const pack = (r, g, b) => ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
    const pal = new Uint32Array(NT * 4);
    DEFS.forEach(d => {
        for (let v = 0; v < 4; v++) {
            let [r, g, b] = hexRGB(d.c[v % d.c.length]);
            if (d.blend) { const a = d.blend; r = r * a + BG[0] * (1 - a) | 0; g = g * a + BG[1] * (1 - a) | 0; b = b * a + BG[2] * (1 - a) | 0; }
            pal[d.id * 4 + v] = pack(r, g, b);
        }
    });
    const BGC = pack(...BG);
    function gradient(stops, n) {
        const out = new Uint32Array(n), lo = stops[0][0], hi = stops[stops.length - 1][0];
        for (let i = 0; i < n; i++) {
            const v = lo + (hi - lo) * i / (n - 1);
            let s = 0; while (s < stops.length - 2 && v > stops[s + 1][0]) s++;
            const [a, ca] = stops[s], [b, cb] = stops[s + 1];
            const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
            const A = hexRGB(ca), B = hexRGB(cb);
            out[i] = pack(A[0] + (B[0] - A[0]) * t | 0, A[1] + (B[1] - A[1]) * t | 0, A[2] + (B[2] - A[2]) * t | 0);
        }
        return out;
    }
    const fireCol = gradient([[0, '#5a1206'], [8, '#a8240a'], [18, '#ff5a10'], [30, '#ffb43a'], [47, '#fff1b8']], 48);
    const T_STOPS = [[-200, '#7a4cff'], [-40, '#2f86ff'], [0, '#7fd6ff'], [20, '#3c4a44'], [100, '#3fae5a'], [300, '#e3d03a'], [700, '#ff7a1a'], [1600, '#ffffff']];
    const tempCol = gradient(T_STOPS, 451);           // 4° per entry from −200 to 1600
    const tempIdx = T => { const k = (T + 200) / 4 | 0; return k < 0 ? 0 : k > 450 ? 450 : k; };
    const unpack = c => [c & 255, (c >> 8) & 255, (c >> 16) & 255];
    const SPARK_HEAD = pack(255, 246, 176), SPARK_TAIL = pack(127, 184, 255);

    const cv = document.getElementById('cv');
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(W, H);
    const buf = new Uint32Array(img.data.buffer);
    let view = 0;

    function baseColor(i, t, fl) {
        if (t === FIRE) { const l = life[i] + (shade[i] & 7); return fireCol[l > 47 ? 47 : l]; }
        if (t === LAVA || t === EMBER) return pal[t * 4 + (((shade[i] + fl * 37) & 255) >> 6)];
        if (chg[i] === 2) return SPARK_HEAD;
        if (chg[i] === 1 && t === METAL) return SPARK_TAIL;
        let c = pal[t * 4 + (shade[i] >> 6)];
        const Tc = temp[i];
        if (Tc > 450 && t !== HEATER) {           // things glow when hot
            const g = Math.min(.85, (Tc - 450) / 900), [r, gg, b] = unpack(c);
            c = pack(r + (255 - r) * g | 0, gg + (110 - gg) * g | 0, b + (30 - b) * g | 0);
        }
        return c;
    }
    function render() {
        const fl = tick >> 2;
        if (view === 1) {
            for (let i = 0; i < N; i++) {
                const t = type[i], c = tempCol[tempIdx(temp[i])];
                if (t === EMPTY) { const [r, g, b] = unpack(c); buf[i] = pack(r * .35 + BG[0] * .65 | 0, g * .35 + BG[1] * .65 | 0, b * .35 + BG[2] * .65 | 0); }
                else buf[i] = c;
            }
        } else {
            for (let i = 0; i < N; i++) { const t = type[i]; buf[i] = t === EMPTY ? BGC : baseColor(i, t, fl); }
            if (view === 2) {
                for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
                    const i = y * W + x, p = P[(y >> 1) * AW + (x >> 1)] + cellP[i];
                    let [r, g, b] = unpack(buf[i]);
                    r = r * .45 | 0; g = g * .45 | 0; b = b * .45 | 0;
                    const a = Math.min(.9, Math.abs(p) / 12);
                    if (p > 0) { r += (255 - r) * a | 0; g += (80 - g) * a | 0; b += (60 - b) * a | 0; }
                    else { r += (60 - r) * a | 0; g += (140 - g) * a | 0; b += (255 - b) * a | 0; }
                    buf[i] = pack(r, g, b);
                }
            }
        }
        ctx.putImageData(img, 0, 0);
        if (hover.x >= 0) {
            ctx.strokeStyle = tool === ERASER ? 'rgba(255,140,120,.7)' : 'rgba(255,240,220,.55)';
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            ctx.arc(hover.x + .5, hover.y + .5, Math.max(.8, brush + .5), 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    // ---------- Painting ----------
    let tool = SAND, brush = 4, drawing = false, erasing = false;
    const hover = { x: -1, y: -1 }, last = { x: -1, y: -1 };
    function paintAt(cx, cy) {
        const t = erasing ? ERASER : tool;
        const r = brush, r2 = r * r + r;
        const k = t === ERASER ? 0 : kind[t];
        const p = (k === K_SOLID || r === 0) ? 1 : 0.22;
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
            if (dx * dx + dy * dy > r2) continue;
            const x = cx + dx, y = cy + dy;
            if (x < 0 || y < 0 || x >= W || y >= H) continue;
            const i = y * W + x;
            if (t === ERASER) { type[i] = EMPTY; temp[i] = AMBIENT; chg[i] = 0; continue; }
            if (type[i] !== EMPTY || rnd() > p) continue;
            spawn(i, t); clk[i] = 0;
        }
    }
    function paintLine(x0, y0, x1, y1) {
        const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
        for (let s = 0; s <= n; s++) paintAt(Math.round(x0 + (x1 - x0) * s / n), Math.round(y0 + (y1 - y0) * s / n));
    }
    function cellOf(e) {
        const r = cv.getBoundingClientRect();
        return { x: Math.floor((e.clientX - r.left) / r.width * W), y: Math.floor((e.clientY - r.top) / r.height * H) };
    }
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('pointerdown', e => {
        e.preventDefault();
        try { cv.setPointerCapture(e.pointerId); } catch (_) { }
        const p = cellOf(e);
        drawing = true; erasing = e.button === 2 || tool === ERASER;
        hover.x = last.x = p.x; hover.y = last.y = p.y;
        paintAt(p.x, p.y);
    });
    cv.addEventListener('pointermove', e => {
        const p = cellOf(e);
        hover.x = p.x; hover.y = p.y;
        if (drawing) { paintLine(last.x, last.y, p.x, p.y); last.x = p.x; last.y = p.y; }
    });
    const stop = () => { drawing = false; };
    cv.addEventListener('pointerup', stop);
    cv.addEventListener('pointercancel', stop);
    cv.addEventListener('pointerleave', () => { if (!drawing) hover.x = -1; });

    // ---------- UI ----------
    const CATS = [['solid', 'Твёрдые'], ['powder', 'Сыпучие'], ['liquid', 'Жидкости'], ['gas', 'Газы и огонь'], ['special', 'Особые']];
    const menu = document.getElementById('menu');
    const buttons = new Map();
    const swatchBg = d => d ? `linear-gradient(135deg, ${d.c[0]} 0 50%, ${d.c[d.c.length > 2 ? 1 : 0]} 50% 100%)` : 'repeating-linear-gradient(45deg,#3b342b 0 3px,#1f1b16 3px 6px)';
    const ERASER_DEF = { n: 'Ластик', d: 'Стирает всё под кистью, включая стены. Правая кнопка мыши стирает при любом выбранном веществе.' };
    for (const [cat, label] of CATS) {
        const g = document.createElement('div'); g.className = 'group';
        g.innerHTML = `<h3>${label}</h3><div class="grid"></div>`;
        const grid = g.querySelector('.grid');
        const items = DEFS.filter(d => d.cat === cat).map(d => ({ id: d.id, def: d }));
        if (cat === 'special') items.push({ id: ERASER, def: null });
        for (const it of items) {
            const b = document.createElement('button');
            b.type = 'button'; b.className = 'el'; b.setAttribute('aria-pressed', 'false');
            b.innerHTML = `<span class="sw"></span><span></span>`;
            b.firstChild.style.background = swatchBg(it.def);
            b.lastChild.textContent = it.def ? it.def.n : ERASER_DEF.n;
            b.addEventListener('click', () => select(it.id));
            buttons.set(it.id, b);
            grid.appendChild(b);
        }
        menu.appendChild(g);
    }

    const tipsBox = document.createElement('div'); tipsBox.className = 'group';
    tipsBox.innerHTML = `<h3>Попробуй</h3><ul class="tips">
<li>Дорисуй <b>металл</b> в разрыв провода над стеклянным ящиком с порохом</li>
<li>Вид <b>Давление</b> во время взрыва, вид <b>Температура</b> у чаши с лавой</li>
<li>Герметичная <b>металлическая</b> труба с водой на <b>нагревателе</b>: наведи курсор внутрь и смотри, как растёт давление. Сделай одну стенку из <b>стекла</b>, чтобы она лопнула</li>
<li><b>Батарею</b> в солёную воду: ток разложит её на горючий газ</li>
<li><b>Лаву</b> в бассейн, <b>охладитель</b> в воду, <b>нитро</b> рядом с нитро</li></ul>`;
    menu.appendChild(tipsBox);

    // scene slots + share code
    const scenes = document.createElement('div'); scenes.className = 'group';
    scenes.innerHTML = `<h3>Сцены</h3><div class="slots" id="slots"></div>
<textarea id="code" aria-label="Код сцены" placeholder="Сюда попадёт код сцены. Вставь чужой код и нажми «Загрузить из кода»."></textarea>
<div class="row"><button class="btn sm" id="copyCode" type="button">Скопировать код</button><button class="btn sm" id="loadCode" type="button">Загрузить из кода</button></div>
<p class="status" id="status" role="status"></p>`;
    menu.appendChild(scenes);

    const statusEl = document.getElementById('status');
    let statusTimer = 0;
    function say(msg) { statusEl.textContent = msg; clearTimeout(statusTimer); statusTimer = setTimeout(() => statusEl.textContent = '', 4000); }
    const store = {
        get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
        set(k, v) { try { localStorage.setItem(k, v); return true; } catch (_) { return false; } },
    };
    const slotsEl = document.getElementById('slots');
    function drawSlots() {
        slotsEl.innerHTML = '';
        for (let s = 1; s <= 3; s++) {
            let meta = null;
            try { meta = JSON.parse(store.get('pesochnica-slot-' + s) || 'null'); } catch (_) { }
            const row = document.createElement('div'); row.className = 'slot';
            const when = meta ? new Date(meta.ts).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'пусто';
            row.innerHTML = `<span><b>Слот ${s}</b>${when}</span>`;
            const sv = document.createElement('button'); sv.type = 'button'; sv.className = 'btn sm'; sv.textContent = 'Сохранить';
            sv.addEventListener('click', () => {
                const ok = store.set('pesochnica-slot-' + s, JSON.stringify({ ts: Date.now(), code: encode() }));
                say(ok ? `Сохранено в слот ${s}` : 'Браузер не даёт сохранять. Используй код сцены.');
                drawSlots();
            });
            const ld = document.createElement('button'); ld.type = 'button'; ld.className = 'btn sm'; ld.textContent = 'Загрузить'; ld.disabled = !meta;
            ld.addEventListener('click', () => {
                try { decode(meta.code); say(`Загружен слот ${s}`); } catch (_) { say('Слот повреждён, загрузить не получилось'); }
            });
            row.append(sv, ld);
            slotsEl.appendChild(row);
        }
    }
    drawSlots();
    const codeEl = document.getElementById('code');
    document.getElementById('copyCode').addEventListener('click', () => {
        const c = encode(); codeEl.value = c;
        const fallback = () => { codeEl.focus(); codeEl.select(); say('Код в поле, скопируй его вручную'); };
        try { navigator.clipboard.writeText(c).then(() => say(`Код скопирован, ${Math.round(c.length / 1024)} КБ`), fallback); } catch (_) { fallback(); }
    });
    document.getElementById('loadCode').addEventListener('click', () => {
        if (!codeEl.value.trim()) { say('Сначала вставь код в поле'); return; }
        try { decode(codeEl.value); say('Сцена загружена'); } catch (_) { say('Код не распознан. Проверь, что он скопирован целиком.'); }
    });

    const hintSw = document.getElementById('hintSw'), hintName = document.getElementById('hintName'), hintDesc = document.getElementById('hintDesc');
    function select(id) {
        tool = id;
        buttons.forEach((b, k) => b.setAttribute('aria-pressed', String(k === id)));
        const d = id === ERASER ? null : DEFS[id];
        hintSw.style.background = swatchBg(d);
        hintName.textContent = d ? d.n : ERASER_DEF.n;
        hintDesc.textContent = d ? d.d : ERASER_DEF.d;
    }
    select(SAND);

    // view modes
    const legend = document.getElementById('legend'), legBar = document.getElementById('legBar'), legL = document.getElementById('legL'), legR = document.getElementById('legR');
    const tGrad = 'linear-gradient(90deg,' + T_STOPS.map(([v, c]) => `${c} ${((v + 200) / 1800 * 100).toFixed(1)}%`).join(',') + ')';
    function setView(v) {
        view = v;
        [0, 1, 2].forEach(k => document.getElementById('v' + k).setAttribute('aria-pressed', String(k === v)));
        legend.hidden = v === 0;
        if (v === 1) { legBar.style.background = tGrad; legL.textContent = '−200 °C'; legR.textContent = '1600 °C'; }
        if (v === 2) { legBar.style.background = 'linear-gradient(90deg,#3c8cff,#2a2520 50%,#ff5040)'; legL.textContent = 'разрежение'; legR.textContent = 'давление'; }
    }
    [0, 1, 2].forEach(k => document.getElementById('v' + k).addEventListener('click', () => setView(k)));

    let running = true, speed = 1;
    const pauseBtn = document.getElementById('pause');
    function togglePause() { running = !running; pauseBtn.textContent = running ? 'Пауза' : 'Продолжить'; pauseBtn.classList.toggle('on', !running); }
    pauseBtn.addEventListener('click', togglePause);
    document.getElementById('step').addEventListener('click', () => { if (running) togglePause(); step(); });
    const speedBtn = document.getElementById('speed');
    speedBtn.addEventListener('click', () => { speed = speed === 1 ? 2 : speed === 2 ? 4 : 1; speedBtn.textContent = 'Скорость ×' + speed; });
    document.getElementById('demo').addEventListener('click', demo);
    const clearBtn = document.getElementById('clear'); let clearArm = 0;
    clearBtn.addEventListener('click', () => {
        if (clearArm) { clearTimeout(clearArm); clearArm = 0; clearAll(); clearBtn.textContent = 'Очистить'; clearBtn.classList.remove('warn'); return; }
        clearBtn.textContent = 'Точно очистить?'; clearBtn.classList.add('warn');
        clearArm = setTimeout(() => { clearArm = 0; clearBtn.textContent = 'Очистить'; clearBtn.classList.remove('warn'); }, 2500);
    });
    const size = document.getElementById('size'), sizeOut = document.getElementById('sizeOut');
    function setBrush(v) { brush = Math.max(0, Math.min(20, v)); size.value = brush; sizeOut.textContent = brush; }
    size.addEventListener('input', () => setBrush(+size.value));
    document.addEventListener('keydown', e => {
        if (e.target.tagName === 'TEXTAREA' || (e.target.tagName === 'INPUT' && e.target.type !== 'range')) return;
        if (e.code === 'Space') { e.preventDefault(); togglePause(); }
        else if (e.key === '[') setBrush(brush - 1);
        else if (e.key === ']') setBrush(brush + 1);
        else if (e.key === '1' || e.key === '2' || e.key === '3') setView(+e.key - 1);
    });

    // ---------- Loop ----------
    const hoverEl = document.getElementById('hover'), countEl = document.getElementById('count'), fpsEl = document.getElementById('fps');
    let fpsT = performance.now(), fpsN = 0;
    function loop(now) {
        if (drawing && last.x >= 0) paintAt(last.x, last.y);
        if (running) for (let s = 0; s < speed; s++) step();
        render();
        fpsN++;
        if (now - fpsT > 500) {
            fpsEl.textContent = Math.round(fpsN * 1000 / (now - fpsT)); fpsN = 0; fpsT = now;
            let c = 0; for (let i = 0; i < N; i++) if (type[i]) c++;
            countEl.textContent = c.toLocaleString('ru-RU');
        }
        if (hover.x >= 0 && hover.x < W && hover.y >= 0 && hover.y < H) {
            const i = hover.y * W + hover.x, t = type[i], p = P[(hover.y >> 1) * AW + (hover.x >> 1)] + cellP[i];
            const sealed = kind[t] !== K_SOLID && !cellOpen[i] ? ' (закрыто)' : '';
            hoverEl.textContent = `${DEFS[t].n} · ${Math.round(temp[i])} °C · давл. ${p >= 0 ? '+' : ''}${p.toFixed(1)}${sealed}${chg[i] === 2 ? ' · ток' : ''}`;
        } else hoverEl.textContent = '—';
        requestAnimationFrame(loop);
    }
    demo();
    requestAnimationFrame(loop);
})();