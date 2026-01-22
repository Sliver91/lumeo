import Phaser from 'phaser';

export class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
        this.gridSize = 6;
        this.stats = {
            1: { color: 0x44abff, name: 'COSMONAUTES', hex: '#44abff', icon: '👨‍🚀' },
            2: { color: 0x33ff33, name: 'XÉNOMORPHES', hex: '#33ff33', icon: '👽' }
        };
        this.isMuted = false;
        this.backgroundMusic = null;
    }

    resetGameVariables() {
        this.currentPlayer = 1;
        this.board = [];
        this.gameOver = false;
        this.isAiThinking = false;
        this.selectedPion = null;
    }

    preload() {
        this.load.audio('ambient_music', 'https://cdn.pixabay.com/audio/2022/05/27/audio_180873747b.mp3');
        const graphics = this.make.graphics({ x: 0, y: 0, add: false });
        graphics.fillStyle(0xffffff, 1);
        graphics.fillCircle(4, 4, 4);
        graphics.generateTexture('particle', 8, 8);
    }

    initMusic() {
        if (!this.backgroundMusic) {
            this.backgroundMusic = this.sound.add('ambient_music', { 
                volume: 0.2, 
                loop: true 
            });
            this.backgroundMusic.play();
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.isMuted) {
            this.muteBtn.setText("🔇");
            this.sound.mute = true;
        } else {
            this.muteBtn.setText("🔊");
            this.sound.mute = false;
            if (!this.backgroundMusic) this.initMusic();
        }
    }

    playSpaceSound(type) {
        if (this.isMuted) return; 
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const master = ctx.createGain();
        master.gain.setValueAtTime(0.1, ctx.currentTime);
        master.connect(ctx.destination);
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.connect(env);
        env.connect(master);
        const now = ctx.currentTime;
        if (type === 'select') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(300, now);
            env.gain.linearRampToValueAtTime(1, now + 0.1);
            env.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        } else if (type === 'move') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.linearRampToValueAtTime(250, now + 0.2);
            env.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        } else if (type === 'infect') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(80, now);
            env.gain.linearRampToValueAtTime(0.5, now + 0.05);
            env.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        } else if (type === 'boost') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.exponentialRampToValueAtTime(880, now + 0.3);
            env.gain.linearRampToValueAtTime(0.3, now + 0.05);
            env.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        }
        osc.start();
        osc.stop(now + 0.6);
    }

    create() {
        this.tweens.killAll();
        this.time.removeAllEvents();
        
        this.resetGameVariables();
        
        const { width, height } = this.cameras.main;
        this.tileSize = Math.floor((height * 0.70) / this.gridSize);
        this.startX = width / 2 - ((this.gridSize - 1) * this.tileSize) / 2;
        this.startY = height / 2 + 80 - ((this.gridSize - 1) * this.tileSize) / 2;

        const bg = this.add.graphics();
        bg.fillGradientStyle(0x050510, 0x050510, 0x100520, 0x100520, 1);
        bg.fillRect(0, 0, width, height);

        // --- AFFICHAGE DE LA VERSION (v0.2) ---
        this.add.text(width - 15, height - 15, "v0.2", {
            fontSize: '14px',
            fill: '#ffffff',
            fontFamily: 'Arial',
            alpha: 0.5
        }).setOrigin(1, 1);

        this.vfxEmitter = this.add.particles(0, 0, 'particle', {
            speed: { min: 20, max: 100 },
            scale: { start: 0.4, end: 0 },
            alpha: { start: 0.6, end: 0 },
            lifespan: 800,
            blendMode: 'ADD',
            emitting: false
        });

        for(let i=0; i<150; i++) {
            const x = Phaser.Math.Between(0, width);
            const y = Phaser.Math.Between(0, height);
            const star = this.add.circle(x, y, Phaser.Math.FloatBetween(0.4, 1.2), 0xffffff, Phaser.Math.FloatBetween(0.1, 0.8));
            if(Math.random() > 0.9) this.tweens.add({ targets: star, alpha: 0, duration: Phaser.Math.Between(1000, 3000), yoyo: true, repeat: -1 });
        }

        this.domBarBg = this.add.rectangle(width/2, 20, width * 0.8, 10, 0xffffff, 0.1);
        this.domBarJ1 = this.add.rectangle(width/2 - (width * 0.4), 20, 0, 10, this.stats[1].color, 1).setOrigin(0, 0.5);
        this.domBarJ2 = this.add.rectangle(width/2 + (width * 0.4), 20, 0, 10, this.stats[2].color, 1).setOrigin(1, 0.5);

        this.portraitJ1 = this.createAvatar(width / 2 - 250, 100, 1);
        this.portraitJ2 = this.createAvatar(width / 2 + 250, 100, 2);

        this.muteBtn = this.add.text(width - 50, 40, this.isMuted ? "🔇" : "🔊", { 
            fontSize: '32px', backgroundColor: '#ffffff11', padding: { x: 10, y: 10 } 
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        
        this.muteBtn.on('pointerdown', (pointer, x, y, event) => {
            event.stopPropagation();
            this.toggleMute();
        });

        this.statusText = this.add.text(width / 2, 50, "TRANSMISSION ÉTABLIE", { 
            fontSize: '16px', fill: '#ffffff', fontFamily: 'Arial', fontStyle: 'bold'
        }).setOrigin(0.5).setAlpha(0.7);

        const scoreCenterOffset = 120;
        this.uiJ1 = this.add.text(width / 2 - scoreCenterOffset, 100, "0", { fontSize: '48px', fill: this.stats[1].hex, fontWeight: 'bold' }).setOrigin(0.5);
        this.uiJ2 = this.add.text(width / 2 + scoreCenterOffset, 100, "0", { fontSize: '48px', fill: this.stats[2].hex, fontWeight: 'bold' }).setOrigin(0.5);

        this.add.text(width / 2 - scoreCenterOffset, 145, this.stats[1].name, { fontSize: '10px', fill: this.stats[1].hex, letterSpacing: 4 }).setOrigin(0.5);
        this.add.text(width / 2 + scoreCenterOffset, 145, this.stats[2].name, { fontSize: '10px', fill: this.stats[2].hex, letterSpacing: 4 }).setOrigin(0.5);

        this.restartBtn = this.add.text(width / 2, height - 50, "INITIALISER NOUVELLE MISSION", {
            fontSize: '20px', fill: '#00ffff', backgroundColor: '#000000', stroke: '#00ffff', strokeThickness: 2, padding: { x: 20, y: 10 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setAlpha(0).setDepth(100);
        
        this.restartBtn.on('pointerdown', (pointer, x, y, event) => {
            event.stopPropagation();
            this.restartGame();
        });

        this.createBoard();
        this.setupInitialPions();
        this.startTurn();

        this.input.on('pointerdown', (pointer) => {
            if (this.gameOver) return;
            if (!this.backgroundMusic && !this.isMuted) this.initMusic();
            this.handleInput(pointer);
        });
    }

    createAvatar(x, y, player) {
        const container = this.add.container(x, y);
        const color = this.stats[player].color;
        const icon = this.stats[player].icon;
        const glow = this.add.circle(0, 0, 45, color, 0.1);
        const mask = this.add.graphics();
        mask.lineStyle(1, color, 0.2);
        for(let i = -40; i < 40; i += 5) { mask.lineBetween(-35, i, 35, i); }
        const avatar = this.add.text(0, 0, icon, { fontSize: '60px' }).setOrigin(0.5);
        const frame = this.add.graphics();
        frame.lineStyle(2, color, 0.8);
        frame.strokeCircle(0, 0, 45);
        frame.lineStyle(4, color, 0.4);
        frame.arc(0, 0, 50, Phaser.Math.DegToRad(0), Phaser.Math.DegToRad(90));
        frame.arc(0, 0, 50, Phaser.Math.DegToRad(180), Phaser.Math.DegToRad(270));
        const liveText = this.add.text(0, 65, "SIGNAL: OK", { 
            fontSize: '10px', fill: '#ffffff', backgroundColor: '#000000aa', padding: {x: 5, y: 2}
        }).setOrigin(0.5);
        container.add([glow, mask, avatar, frame, liveText]);
        this.tweens.add({
            targets: container, y: y - 8, duration: 2000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
        });
        return { container, avatar, liveText, color };
    }

    update() {
        [this.portraitJ1, this.portraitJ2].forEach(p => {
            if (p && Math.random() > 0.98) {
                p.container.x += Phaser.Math.Between(-3, 3);
                this.time.delayedCall(50, () => {
                    if(this.scene.isActive()) p.container.x = (p === this.portraitJ1 ? this.cameras.main.width / 2 - 250 : this.cameras.main.width / 2 + 250);
                });
                p.avatar.setAlpha(0.5);
                this.time.delayedCall(100, () => { if(this.scene.isActive()) p.avatar.setAlpha(1); });
            }
        });
    }

    updateAvatarExpression() {
        const c1 = this.board.flat().filter(c => c.owner === 1).length;
        const c2 = this.board.flat().filter(c => c.owner === 2).length;
        const update = (portrait, scoreSelf, scoreEnemy) => {
            if (scoreSelf > scoreEnemy + 5) portrait.liveText.setText("DOMINATION").setFill('#00ff00');
            else if (scoreSelf < scoreEnemy - 5) portrait.liveText.setText("ALERTE: CRITIQUE").setFill('#ff0000');
            else portrait.liveText.setText("SIGNAL: STABLE").setFill('#ffffff');
        };
        update(this.portraitJ1, c1, c2);
        update(this.portraitJ2, c2, c1);
    }

    createBoard() {
        this.board = [];
        const blackHoleCoords = [];
        if (Math.random() < 0.3) {
            const count = Math.random() > 0.5 ? 2 : 1;
            for(let i=0; i<count; i++) blackHoleCoords.push({x: Phaser.Math.Between(2,3), y: Phaser.Math.Between(2,3)});
        }
        const nebulaCoord = Math.random() < 0.4 ? {x: Phaser.Math.Between(1,4), y: Phaser.Math.Between(1,4)} : null;

        for (let y = 0; y < this.gridSize; y++) {
            this.board[y] = [];
            for (let x = 0; x < this.gridSize; x++) {
                const px = this.startX + (x * this.tileSize);
                const py = this.startY + (y * this.tileSize);
                const container = this.add.container(px, py);
                let isObstacle = blackHoleCoords.some(c => c.x === x && c.y === y);
                let isBoost = nebulaCoord && nebulaCoord.x === x && nebulaCoord.y === y;
                const tile = this.add.rectangle(0, 0, this.tileSize - 8, this.tileSize - 8, 0xffffff, 0.03);
                tile.setStrokeStyle(1, 0xffffff, 0.1).setRotation(Phaser.Math.DegToRad(45)); 
                if (isObstacle) {
                    tile.setFillStyle(0x000000, 0.8).setStrokeStyle(2, 0x9900ff, 0.5);
                    this.add.text(px, py, "🌑", {fontSize: '30px'}).setOrigin(0.5).setAlpha(0.5);
                } else if (isBoost) {
                    tile.setFillStyle(0x00ffff, 0.1).setStrokeStyle(2, 0x00ffff, 0.4);
                    const bIcon = this.add.text(px, py, "✨", {fontSize: '30px'}).setOrigin(0.5);
                    this.tweens.add({ targets: bIcon, alpha: 0.2, duration: 800, yoyo: true, repeat: -1 });
                }
                container.add(tile);
                this.board[y][x] = { x, y, owner: isObstacle ? -1 : 0, isBoost, visual: tile, container, pionObj: null };
            }
        }
    }

    setOwner(cell, player, skipAnim = false) {
        if (cell.owner === -1) return;
        cell.owner = player;
        if (cell.pionObj) cell.pionObj.destroy();
        if (player !== 0) {
            const color = this.stats[player].color;
            const icon = this.stats[player].icon;
            const pionContainer = this.add.container(0, 0);
            const base = this.add.ellipse(0, 15, this.tileSize * 0.6, 10, color, 0.2);
            const unit = this.add.text(0, 0, icon, { fontSize: `${this.tileSize * 0.5}px` }).setOrigin(0.5);
            this.createDynamicLight(cell, color);
            pionContainer.add([base, unit]);
            cell.container.add(pionContainer);
            cell.pionObj = pionContainer;
            if (!skipAnim) {
                pionContainer.setScale(0);
                this.tweens.add({ targets: pionContainer, scale: 1, duration: 400, ease: 'Back.out' });
            }
            this.tweens.add({ targets: unit, y: -3, alpha: 0.7, duration: 1000 + Math.random() * 500, yoyo: true, repeat: -1 });
        }
        this.refreshUI();
    }

    createDynamicLight(cell, color) {
        this.getNeighbors(cell, 1).forEach(n => {
            const glow = this.add.circle(n.container.x, n.container.y, this.tileSize / 2, color, 0);
            this.tweens.add({ targets: glow, alpha: 0.15, duration: 600, yoyo: true, onComplete: () => glow.destroy() });
        });
    }

    getNeighbors(cell, range) {
        let neighbors = [];
        for (let y = -range; y <= range; y++) {
            for (let x = -range; x <= range; x++) {
                if (x === 0 && y === 0) continue;
                const ny = cell.y + y, nx = cell.x + x;
                if (ny >= 0 && ny < this.gridSize && nx >= 0 && nx < this.gridSize) neighbors.push(this.board[ny][nx]);
            }
        }
        return neighbors;
    }

    showPossibilities(cell) {
        const color = this.stats[this.currentPlayer].color;
        for (let y = -2; y <= 2; y++) {
            for (let x = -2; x <= 2; x++) {
                const ny = cell.y + y, nx = cell.x + x;
                if (ny >= 0 && ny < this.gridSize && nx >= 0 && nx < this.gridSize) {
                    const target = this.board[ny][nx];
                    if (target.owner === 0) {
                        const dist = Math.max(Math.abs(x), Math.abs(y));
                        if (dist === 1) { target.visual.setFillStyle(color, 0.3); target.visual.setStrokeStyle(2, color, 0.8); }
                        else { target.visual.setStrokeStyle(1, color, 0.4); target.visual.setFillStyle(color, 0.1); }
                        this.tweens.add({ targets: target.visual, alpha: 0.5, duration: 500, yoyo: true, repeat: -1 });
                    }
                }
            }
        }
    }

    infect(cell) {
        let victims = [];
        const range = cell.isBoost ? 2 : 1;
        if (cell.isBoost) this.playSpaceSound('boost');
        this.createShockwave(cell.container.x, cell.container.y, this.stats[this.currentPlayer].color);
        for (let y = -range; y <= range; y++) {
            for (let x = -range; x <= range; x++) {
                const ny = cell.y + y, nx = cell.x + x;
                if (ny >= 0 && ny < this.gridSize && nx >= 0 && nx < this.gridSize) {
                    const target = this.board[ny][nx];
                    if (target.owner > 0 && target.owner !== this.currentPlayer) victims.push(target);
                }
            }
        }
        if(victims.length > 0) this.playSpaceSound('infect');
        victims.forEach((v, i) => {
            this.time.delayedCall(i * 150, () => {
                if(!this.scene.isActive()) return;
                const line = this.add.line(0, 0, cell.container.x, cell.container.y, v.container.x, v.container.y, this.stats[this.currentPlayer].color).setOrigin(0).setLineWidth(2).setAlpha(0.8);
                this.tweens.add({ targets: line, alpha: 0, duration: 300, onComplete: () => line.destroy() });
                this.setOwner(v, this.currentPlayer);
            });
        });
        this.time.delayedCall(victims.length * 150 + 200, () => { if(this.scene.isActive()) this.endTurn(); });
    }

    createShockwave(x, y, color) {
        const circle = this.add.circle(x, y, 10, color, 0.5);
        circle.setStrokeStyle(2, color, 1);
        this.tweens.add({ targets: circle, radius: this.tileSize * 2, alpha: 0, duration: 600, ease: 'Cubic.out', onComplete: () => circle.destroy() });
    }

    handleInput(pointer) {
        if (this.gameOver || this.currentPlayer === 2 || this.isAiThinking) return;
        let closest = null;
        let minDist = 50;
        this.board.flat().forEach(cell => {
            const d = Phaser.Math.Distance.Between(pointer.x, pointer.y, cell.container.x, cell.container.y);
            if (d < minDist) { minDist = d; closest = cell; }
        });
        if (closest) {
            if (closest.owner === this.currentPlayer) {
                this.playSpaceSound('select');
                this.clearSelection();
                this.selectedPion = closest;
                closest.visual.setStrokeStyle(3, 0xffffff, 1).setFillStyle(0xffffff, 0.2);
                this.showPossibilities(closest);
            } else if (this.selectedPion && closest.owner === 0) {
                const dist = Math.max(Math.abs(this.selectedPion.x - closest.x), Math.abs(this.selectedPion.y - closest.y));
                if (dist <= 2) { this.playSpaceSound('move'); this.executeMove(this.selectedPion, closest); }
            }
        }
    }

    executeMove(from, to) {
        if (this.gameOver) return;
        const dist = Math.max(Math.abs(from.x - to.x), Math.abs(from.y - to.y));
        const color = this.stats[this.currentPlayer].color;
        if (dist === 2) { 
            this.vfxEmitter.setConfig({ x: from.container.x, y: from.container.y, tint: color, moveToX: to.container.x, moveToY: to.container.y, emitting: true });
            this.time.delayedCall(400, () => this.vfxEmitter.stop());
            from.owner = 0; 
            if (from.pionObj) from.pionObj.destroy();
            from.pionObj = null; 
        } else { this.vfxEmitter.emitParticleAt(from.container.x, from.container.y, 10); }
        this.setOwner(to, this.currentPlayer);
        this.infect(to);
    }

    setupInitialPions() {
        const possiblePositions = [{x: 0, y: 0}, {x: 1, y: 0}, {x: 0, y: 1}, {x: this.gridSize - 1, y: 1}, {x: this.gridSize - 2, y: 0}];
        Phaser.Utils.Array.Shuffle(possiblePositions).slice(0, Phaser.Math.Between(1, 3)).forEach(pos => {
            const cellJ1 = this.board[pos.y][pos.x];
            if (cellJ1.owner !== -1) this.setOwner(cellJ1, 1, true);
            const cellJ2 = this.board[(this.gridSize - 1) - pos.y][(this.gridSize - 1) - pos.x];
            if (cellJ2.owner !== -1) this.setOwner(cellJ2, 2, true);
        });
    }

    startTurn() {
        if (this.gameOver) return;
        if (this.currentPlayer === 2) {
            this.statusText.setText("ESSAIE DE SURVIVRE À L'INVASION...");
            this.isAiThinking = true;
            this.time.delayedCall(1000, () => { if(this.scene.isActive()) this.makeAiMove(); });
        } else {
            this.isAiThinking = false;
            this.statusText.setText(`TOUR DES ${this.stats[1].name}`);
        }
    }

    makeAiMove() {
        if (this.gameOver) return;
        let bestMove = null, maxScore = -999;
        this.board.flat().filter(c => c.owner === 2).forEach(pion => {
            for (let y = -2; y <= 2; y++) {
                for (let x = -2; x <= 2; x++) {
                    const ny = pion.y + y, nx = pion.x + x;
                    if (ny >= 0 && ny < this.gridSize && nx >= 0 && nx < this.gridSize) {
                        const target = this.board[ny][nx];
                        if (target.owner === 0) {
                            let score = this.calculateInfectionScore(target, 2);
                            if (Math.max(Math.abs(pion.x - nx), Math.abs(pion.y - ny)) === 1) score += 1.1;
                            if (score > maxScore) { maxScore = score; bestMove = { from: pion, to: target }; }
                        }
                    }
                }
            }
        });
        if (bestMove) this.executeMove(bestMove.from, bestMove.to);
        else this.endTurn();
    }

    calculateInfectionScore(targetCell, player) {
        let count = 0;
        const range = targetCell.isBoost ? 2 : 1;
        for (let iy = -range; iy <= range; iy++) {
            for (let ix = -range; ix <= range; ix++) {
                const ny = targetCell.y + iy, nx = targetCell.x + ix;
                if (ny >= 0 && ny < this.gridSize && nx >= 0 && nx < this.gridSize) {
                    const c = this.board[ny][nx];
                    if (c.owner > 0 && c.owner !== player) count++;
                }
            }
        }
        return count;
    }

    endTurn() {
        if (this.gameOver) return;
        this.currentPlayer = (this.currentPlayer === 1) ? 2 : 1;
        this.clearSelection();
        this.refreshUI();
        if (this.checkGameOver()) return;
        if (!this.hasPossibleMoves(this.currentPlayer)) {
            this.currentPlayer = (this.currentPlayer === 1) ? 2 : 1;
            if (!this.hasPossibleMoves(this.currentPlayer)) this.finishGame();
            else this.startTurn();
        } else this.startTurn();
    }

    hasPossibleMoves(player) {
        return this.board.flat().some(cell => {
            if (cell.owner !== player) return false;
            for (let y = -2; y <= 2; y++) {
                for (let x = -2; x <= 2; x++) {
                    const ny = cell.y + y, nx = cell.x + x;
                    if (ny >= 0 && ny < this.gridSize && nx >= 0 && nx < this.gridSize && this.board[ny][nx].owner === 0) return true;
                }
            }
            return false;
        });
    }

    checkGameOver() {
        const c1 = this.board.flat().filter(c => c.owner === 1).length;
        const c2 = this.board.flat().filter(c => c.owner === 2).length;
        if (c1 === 0 || c2 === 0 || this.board.flat().every(c => c.owner !== 0)) {
            this.finishGame();
            return true;
        }
        return false;
    }

    finishGame() {
        this.gameOver = true;
        this.isAiThinking = false;
        const c1 = this.board.flat().filter(c => c.owner === 1).length;
        const c2 = this.board.flat().filter(c => c.owner === 2).length;
        let result = c1 === c2 ? "PACTE DE NON-AGRESSION" : (c1 > c2 ? `LES HUMAINS ONT SURVÉCU !` : `LA TERRE EST ENVAHIE !`);
        this.statusText.setText(result).setAlpha(1).setFontSize('24px');
        this.restartBtn.setAlpha(1);
    }

    restartGame() {
        this.input.removeAllListeners();
        this.tweens.killAll();
        this.time.removeAllEvents();
        this.scene.restart();
    }

    clearSelection() {
        this.board.flat().forEach(c => {
            this.tweens.killTweensOf(c.visual);
            if (c.owner === -1) { c.visual.setStrokeStyle(2, 0x9900ff, 0.5); c.visual.setFillStyle(0x000000, 0.8); }
            else if (c.isBoost) { c.visual.setStrokeStyle(2, 0x00ffff, 0.4); c.visual.setFillStyle(0x00ffff, 0.1); }
            else { c.visual.setStrokeStyle(1, 0xffffff, 0.1); c.visual.setFillStyle(0xffffff, 0.03); }
            c.visual.setAlpha(1);
        });
        this.selectedPion = null;
    }

    refreshUI() {
        const cells = this.board.flat().filter(c => c.owner !== -1);
        const c1 = cells.filter(c => c.owner === 1).length, c2 = cells.filter(c => c.owner === 2).length, total = cells.length;
        this.uiJ1.setText(`${c1}`);
        this.uiJ2.setText(`${c2}`);
        const fullWidth = this.cameras.main.width * 0.8;
        this.tweens.add({ targets: this.domBarJ1, width: (c1 / total) * fullWidth, duration: 500, ease: 'Power2' });
        this.tweens.add({ targets: this.domBarJ2, width: (c2 / total) * fullWidth, duration: 500, ease: 'Power2' });
        this.updateAvatarExpression();
    }
}
