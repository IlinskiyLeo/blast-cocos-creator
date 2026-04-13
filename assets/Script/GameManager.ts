// Learn TypeScript:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/typescript.html
// Learn Attribute:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/reference/attributes.html
// Learn life-cycle callbacks:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/life-cycle-callbacks.html
import BlockData from "./BlockData";

const {ccclass, property} = cc._decorator;

@ccclass
export default class GameManager extends cc.Component {

    @property(cc.Node)
    scoreCount: cc.Node = null;

    @property(cc.Node)
    movesCount: cc.Node = null;

    @property(cc.Prefab)
    block_blue: cc.Prefab = null;

    @property(cc.Prefab)
    block_green: cc.Prefab = null;

    @property(cc.Prefab)
    block_purpure: cc.Prefab = null;

    @property(cc.Prefab)
    block_red: cc.Prefab = null;

    @property(cc.Prefab)
    block_yellow: cc.Prefab = null;

    @property(cc.Prefab)
    block_bomb: cc.Prefab = null;

    @property(cc.Prefab)
    block_bomb_max: cc.Prefab = null;

    @property(cc.Prefab)
    block_rockets_h: cc.Prefab = null;

    @property(cc.Prefab)
    block_rockets_v: cc.Prefab = null;

    @property(cc.Node)
    playframe: cc.Node = null;

    @property(cc.Node)
    panelWin: cc.Node = null;

    @property(cc.Node)
    panelLose: cc.Node = null;

    @property(cc.Node)
    boosterOneButton: cc.Node = null;

    @property(cc.Node)
    boosterOneCount: cc.Node = null;

    @property(cc.Node)
    boosterTwoButton: cc.Node = null;

    @property(cc.Node)
    boosterTwoCount: cc.Node = null;


    grid: cc.Node[][] = [];
    cols: number = 9;
    rows: number = 9;
    yStepSize: number = 112;
    xStepSize: number = 101;
    initialX: number = 85;
    initialY: number = 100;
    score: number = 0;
    moves: number = 15;
    isInteractable: boolean = true;
    activeBooster: string | null = null; // "bomb" | "rocket" | null
    boosterOneCharges: number = 5;
    boosterTwoCharges: number = 5;
    teleportFirstBlock: { row: number, col: number } | null = null;
    shuffleCount: number = 0;

    private onHomePressed(): void {
        // for now just restart the game, home scene can be added later
        cc.director.loadScene("MainScene");
    }

    private onRestartPressed(): void {
        cc.director.loadScene("MainScene");
    }

    private onNextLevelPressed(): void {
        // for now same as restart, levels can be added later
        cc.director.loadScene("MainScene");
    }

    getRandomBlock(): { prefab: cc.Prefab, color: string } {
        const blocksArray = [
            { prefab: this.block_blue,    color: "blue"    },
            { prefab: this.block_green,   color: "green"   },
            { prefab: this.block_purpure, color: "purple"  },
            { prefab: this.block_red,     color: "red"     },
            { prefab: this.block_yellow,  color: "yellow"  },
        ];
        return blocksArray[Math.floor(Math.random() * blocksArray.length)];
    }

    private generateElementsRow(rowIndex: number, rowsOrColsNumber: number, coordinatePointX: number, coordinatePointY: number, axis: string, step: number): void {
        this.grid[rowIndex] = []; // initialize this row
        for (let i = 0; i < rowsOrColsNumber; i++) {
            const { prefab, color } = this.getRandomBlock();
            const block = cc.instantiate(prefab);

            const data = block.addComponent(BlockData);
            data.color = color;
            data.type = "normal";
            block.name = color;

            if (axis === "x") {
                block.setPosition(coordinatePointX, coordinatePointY);
                coordinatePointX = coordinatePointX + step;
            }
            this.playframe.addChild(block);
            this.grid[rowIndex][i] = block; // ADD THIS — store the reference

            block.on(cc.Node.EventType.TOUCH_END, () => {
                this.onBlockTapped(block, i, rowIndex);
            }, this);
        }
    }

    private shakeBlock(block: cc.Node): void {
        const originalX = block.x;
        cc.tween(block)
            .to(0.05, { x: originalX - 10 })
            .to(0.05, { x: originalX + 10 })
            .to(0.05, { x: originalX - 10 })
            .to(0.05, { x: originalX })
            .start();
    }

    private async handleNormalBlast(block: cc.Node, row: number, col: number, color: string): Promise<void> {
        const matched = this.getConnectedBlocks(row, col, color);

        if (matched.length < 2) {
            this.shakeBlock(block);
            return;
        }

        // save tapped position BEFORE loop shadows them
        const spawnRow = row;
        const spawnCol = col;

        for (const {row, col} of matched) {
            this.grid[row][col].destroy();
            this.grid[row][col] = null;
        }

        this.updateScore(matched.length);

        if (matched.length >= 7) {
            this.spawnSpecialBlock(spawnRow, spawnCol, "bomb");
            console.log(spawnCol, spawnRow, 'spawning position');
        } else if (matched.length >= 5) {
            const rocketType = Math.random() < 0.5 ? "rocket_h" : "rocket_v";
            this.spawnSpecialBlock(spawnRow, spawnCol, rocketType);
        }
    }

    private spawnSpecialBlock(row: number, col: number, type: string): void {
        let prefab: cc.Prefab;

        switch (type) {
            case "bomb":     prefab = this.block_bomb; break;
            case "rocket_h": prefab = this.block_rockets_h; break;
            case "rocket_v": prefab = this.block_rockets_v; break;
        }

        const block = cc.instantiate(prefab);
        const data = block.addComponent(BlockData);
        data.type = type;
        data.color = "special"; // special blocks have no color for BFS

        const x = this.initialX + col * this.xStepSize;
        const y = this.initialY + row * this.yStepSize;
        block.setPosition(x, y);
        this.playframe.addChild(block);
        this.grid[row][col] = block;

        block.on(cc.Node.EventType.TOUCH_END, () => {
            this.onBlockTapped(block, col, row);
        }, this);
    }

    private async animateDestroy(block: cc.Node): Promise<void> {
        return new Promise<void>((resolve) => {
            cc.tween(block)
                .to(0.01, { scale: 1.3 })
                .to(0.01, { scale: 0 })
                .call(() => resolve())
                .start();
        });
    }

    private async onBlockTapped(block: cc.Node, col: number, row: number): Promise<void> {
        if (!this.isInteractable) return;

        // teleport needs its own flow — check BEFORE generic booster
        if (this.activeBooster === "teleport") {
            await this.applyTeleport(row, col);
            return;
        }

        if (this.activeBooster !== null) {
            await this.applyBooster(row, col);
            return;
        }

        const data = block.getComponent(BlockData);
        switch (data.type) {
            case "normal":
                await this.handleNormalBlast(block, row, col, data.color);
                break;
            case "bomb":
                await this.handleBombBlast(row, col);
                break;
            case "rocket_h": 
                await this.handleRocket(true, row, col); 
                break;
            case "rocket_v": 
                await this.handleRocket(false, row, col); 
                break;
        }

        this.updateMoves();
        await this.applyGravity();
        this.checkGameState();
    }

    private async handleRocket(isHorizontal: boolean, row: number, col: number): Promise<void> {
        const startPos = isHorizontal ? col : row;
        const maxPos = isHorizontal ? this.cols : this.rows;
        const maxDist = Math.max(startPos, maxPos - 1 - startPos);
        const toDestroy: { row: number, col: number, chainType?: string }[] = [];

        // collect all blocks in row or column
        for (let i = 0; i < maxPos; i++) {
            const r = isHorizontal ? row : i;
            const c = isHorizontal ? i : col;
            if (!this.grid[r][c]) continue;
            const data = this.grid[r][c].getComponent(BlockData);
            toDestroy.push({
                row: r, col: c,
                chainType: data && data.type !== "normal" ? data.type : undefined
            });
        }

        // animate pair by pair outward from rocket position
        for (let dist = 0; dist <= maxDist; dist++) {
            const pairPromises: Promise<void>[] = [];
            const a = startPos - dist; // left or down
            const b = startPos + dist; // right or up

            const ra = isHorizontal ? row : a;
            const ca = isHorizontal ? a : col;
            const rb = isHorizontal ? row : b;
            const cb = isHorizontal ? b : col;

            if (a >= 0 && this.grid[ra][ca]) {
                pairPromises.push(this.animateDestroy(this.grid[ra][ca]));
            }
            if (b !== a && b < maxPos && this.grid[rb][cb]) {
                pairPromises.push(this.animateDestroy(this.grid[rb][cb]));
            }

            await Promise.all(pairPromises);

            if (a >= 0 && this.grid[ra][ca]) {
                this.grid[ra][ca].destroy();
                this.grid[ra][ca] = null;
            }
            if (b !== a && b < maxPos && this.grid[rb][cb]) {
                this.grid[rb][cb].destroy();
                this.grid[rb][cb] = null;
            }
        }

        // chain reactions
        for (const { row, col, chainType } of toDestroy) {
            if (chainType) {
                switch (chainType) {
                    case "bomb":     await this.handleBombBlast(row, col); break;
                    case "rocket_h": await this.handleRocket(true, row, col); break;
                    case "rocket_v": await this.handleRocket(false, row, col); break;
                }
            }
        }

        this.updateScore(maxPos);
    }

    private async handleBombBlast(row: number, col: number): Promise<void> {
        // first animate bomb itself
        if (this.grid[row][col]) {
            await this.animateDestroy(this.grid[row][col]);
            this.grid[row][col].destroy();
            this.grid[row][col] = null;
        }

        // then collect all 8 neighbors
        const neighborPromises: Promise<void>[] = [];
        const toDestroy: { r: number, c: number, chainType?: string }[] = [];

        for (let r = row - 1; r <= row + 1; r++) {
            for (let c = col - 1; c <= col + 1; c++) {
                if (r === row && c === col) continue; // skip bomb center
                if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) continue;
                if (!this.grid[r][c]) continue;

                const data = this.grid[r][c].getComponent(BlockData);
                if (data && data.type !== "normal") {
                    toDestroy.push({ r, c, chainType: data.type });
                } else {
                    toDestroy.push({ r, c });
                }
                neighborPromises.push(this.animateDestroy(this.grid[r][c]));
            }
        }

        // animate all neighbors simultaneously
        await Promise.all(neighborPromises);

        // destroy all and chain react
        for (const { r, c, chainType } of toDestroy) {
            if (this.grid[r][c]) {
                this.grid[r][c].destroy();
                this.grid[r][c] = null;
            }
            if (chainType) {
                switch (chainType) {
                    case "bomb":     await this.handleBombBlast(r, c); break;
                    case "rocket_h": await this.handleRocket(true, r, c); break;
                    case "rocket_v": await this.handleRocket(false, r, c); break;
                }
            }
        }

        this.updateScore(9);
    }


    private getConnectedBlocks(startRow: number, startCol: number, color: string): {row: number, col: number}[] {
        const matched = [];
        const visited = new Set<string>();
        const queue = [{row: startRow, col: startCol}];

        while (queue.length > 0) {
            const {row, col} = queue.shift();
            const key = `${row},${col}`;

            if (visited.has(key)) continue; // already checked this cell
            visited.add(key);

            const block = this.grid[row][col];
            if (!block || block.name !== color) continue; // empty or different color

            matched.push({row, col});

            // check all 4 neighbors
            const neighbors = [
                {row: row - 1, col: col}, // down
                {row: row + 1, col: col}, // up
                {row: row, col: col - 1}, // left
                {row: row, col: col + 1}, // right
            ];

            for (const n of neighbors) {
                // make sure neighbor is inside grid bounds
                if (n.row >= 0 && n.row < this.rows && n.col >= 0 && n.col < this.cols) {
                    queue.push(n);
                }
            }
        }

        return matched;
    }

    private setGridInteractable(interactable: boolean): void {
        this.isInteractable = interactable;
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                if (this.grid[row][col]) {
                    if (interactable) {
                        // re-enable — but animateFall already handles this per block
                    } else {
                        this.grid[row][col].off(cc.Node.EventType.TOUCH_END);
                    }
                }
            }
        }
    }

    private animateFall(block: cc.Node, targetY: number, col: number, row: number): Promise<void> {
        return new Promise((resolve) => {
            cc.tween(block)
                .to(0.45, { y: targetY }, { easing: 'bounceOut' })
                .call(() => {
                    // re-enable tap with correct final position
                    block.on(cc.Node.EventType.TOUCH_END, () => {
                        this.onBlockTapped(block, col, row);
                    }, this);
                    resolve();
                })
                .start();
        });
    }

    private async applyGravity(): Promise<void> {
        const animationPromises: Promise<void>[] = [];
        const spawnY = this.initialY + this.rows * this.yStepSize; // above grid

        this.setGridInteractable(false); // disable all taps during animation

        for (let col = 0; col < this.cols; col++) {
            const surviving = [];
            for (let row = 0; row < this.rows; row++) {
                if (this.grid[row][col] !== null) {
                    surviving.push(this.grid[row][col]);
                }
            }

            for (let row = 0; row < this.rows; row++) {
                const x = this.initialX + col * this.xStepSize;
                const y = this.initialY + row * this.yStepSize;

                if (row < surviving.length) {
                    // surviving block — animate fall to new position
                    this.grid[row][col] = surviving[row];
                    this.grid[row][col].setPosition(x, this.grid[row][col].y);
                    animationPromises.push(this.animateFall(this.grid[row][col], y, col, row));
                } else {
                    // new block — spawn above grid then animate fall
                    const { prefab, color } = this.getRandomBlock();
                    const block = cc.instantiate(prefab);
                    block.name = color;
                    const data = block.addComponent(BlockData);
                    data.color = color;
                    data.type = "normal";
                    block.setPosition(x, spawnY); // start above grid
                    this.playframe.addChild(block);
                    this.grid[row][col] = block;
                    animationPromises.push(this.animateFall(block, y, col, row));
                }
            }
        }

        await Promise.all(animationPromises); // wait for everything to land
    }

    private async applyBooster(row: number, col: number): Promise<void> {
        const boosterType = this.activeBooster;
        
        // always clear booster state first
        this.activeBooster = null;
        const button = boosterType === "bomb" ? this.boosterTwoButton : this.boosterOneButton;
        this.stopBoosterPulse(button);

        // then check count
        if (boosterType === "bomb") {
            if (this.boosterTwoCharges <= 0) return;
            this.boosterTwoCharges--;
            this.boosterTwoCount.getComponent(cc.Label).string = `${this.boosterTwoCharges}`;
            await this.handleBombBlast(row, col);
        }

        this.updateMoves();
        await this.applyGravity();
        this.checkGameState();
    }

    private async applyTeleport(row: number, col: number): Promise<void> {
        if (this.teleportFirstBlock === null) {
            // first tap — store selection and highlight
            this.teleportFirstBlock = { row, col };
            this.grid[row][col].scale = 1.3; // highlight selected block
            return; // wait for second tap
        }

        // second tap — swap blocks
        const first = this.teleportFirstBlock;
        this.teleportFirstBlock = null;

        // reset highlight on first block
        this.grid[first.row][first.col].scale = 1.0;

        // swap in grid
        const blockA = this.grid[first.row][first.col];
        const blockB = this.grid[row][col];

        this.grid[first.row][first.col] = blockB;
        this.grid[row][col] = blockA;

        // swap visual positions
        const posA = blockA.getPosition();
        const posB = blockB.getPosition();
        blockA.setPosition(posB);
        blockB.setPosition(posA);

        // update tap listeners with new positions
        blockA.targetOff(this);
        blockA.on(cc.Node.EventType.TOUCH_END, () => {
            this.onBlockTapped(blockA, col, row);
        }, this);

        blockB.targetOff(this);
        blockB.on(cc.Node.EventType.TOUCH_END, () => {
            this.onBlockTapped(blockB, first.col, first.row);
        }, this);

        // clear booster state
        this.activeBooster = null;
        this.stopBoosterPulse(this.boosterOneButton);
        this.boosterOneCharges--;
        this.boosterOneCount.getComponent(cc.Label).string = `${this.boosterOneCharges}`;

        this.updateMoves();
        await this.applyGravity();
        this.checkGameState();
    }

    private onBombBoosterPressed(): void {
        this.onBoosterSelected("bomb");
    }

    private onTeleportBoosterPressed(): void {
        this.onBoosterSelected("teleport");
    }

    private onBoosterSelected(type: string): void {
        const button = type === "teleport" ? this.boosterOneButton : this.boosterTwoButton;

        if (this.activeBooster === type) {
            // cancel — stop pulse
            this.activeBooster = null;
            this.stopBoosterPulse(button);

            if (type === "teleport" && this.teleportFirstBlock !== null) {
                this.grid[this.teleportFirstBlock.row][this.teleportFirstBlock.col].scale = 1.0;
                this.teleportFirstBlock = null;
            }
        } else {
            // stop pulse on previously selected booster if any
            if (this.activeBooster !== null) {
                const prevButton = this.activeBooster === "teleport" ? this.boosterOneButton : this.boosterTwoButton;
                this.stopBoosterPulse(prevButton);
            }
            this.activeBooster = type;
            this.startBoosterPulse(button);
        }
    }

    private startBoosterPulse(button: cc.Node): void {
        cc.tween(button)
            .to(0.2, { scale: 1.2 })
            .to(0.2, { scale: 1.0 })
            .union()
            .repeatForever()
            .start();
    }

    private stopBoosterPulse(button: cc.Node): void {
        cc.Tween.stopAllByTarget(button); // stop all tweens on this node
        button.scale = 1.0; // reset to original size
    }

    private updateScore(blocksDestroyed: number): void {
        this.score += blocksDestroyed * 10; // 10 points per block
        this.scoreCount.getComponent(cc.Label).string = `${this.score}/500`;
    }

    private updateMoves(): void {
        this.moves-=1;
        this.movesCount.getComponent(cc.Label).string = `${this.moves}`;
    }

    private hasAvailableMoves(): boolean {
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const block = this.grid[row][col];
                if (!block) continue;

                const data = block.getComponent(BlockData);

                // special blocks are always tappable
                if (data.type !== "normal") return true;

                // check 4 neighbors for same color
                const neighbors = [
                    {row: row - 1, col: col},
                    {row: row + 1, col: col},
                    {row: row, col: col - 1},
                    {row: row, col: col + 1},
                ];

                for (const n of neighbors) {
                    if (n.row < 0 || n.row >= this.rows || n.col < 0 || n.col >= this.cols) continue;
                    const neighbor = this.grid[n.row][n.col];
                    if (neighbor && neighbor.name === block.name) return true;
                }
            }
        }
        return false; // no moves found
    }

    private async checkAndShuffle(): Promise<void> {
        if (this.hasAvailableMoves()) return; // moves exist, no shuffle needed

        if (this.shuffleCount >= 3) {
            this.onLose(); // shuffled 3 times, still no moves
            return;
        }

        this.shuffleCount++;
        console.log(`No moves! Shuffling... attempt ${this.shuffleCount}`);
        await this.shuffleGrid();

        // check again recursively after shuffle
        await this.checkAndShuffle();
        this.setGridInteractable(true);
    }

    private async shuffleGrid(): Promise<void> {
        this.setGridInteractable(false);

        // collect all normal block nodes with their current positions
        const entries: { block: cc.Node, data: BlockData }[] = [];
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const block = this.grid[row][col];
                if (!block) continue;
                const data = block.getComponent(BlockData);
                if (data.type === "normal") {
                    entries.push({ block, data });
                }
            }
        }

        // fisher-yates shuffle the entries array — shuffles actual nodes
        for (let i = entries.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [entries[i], entries[j]] = [entries[j], entries[i]];
        }

        // reassign grid positions and animate
        const scatterPromises: Promise<void>[] = [];
        let entryIndex = 0;

        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                if (!this.grid[row][col]) continue;

                const data = this.grid[row][col].getComponent(BlockData);
                if (data.type !== "normal") continue;

                const { block } = entries[entryIndex++];
                this.grid[row][col] = block; // update grid reference

                const targetX = this.initialX + col * this.xStepSize;
                const targetY = this.initialY + row * this.yStepSize;

                // capture for closure
                const capturedCol = col;
                const capturedRow = row;

                scatterPromises.push(new Promise<void>((resolve) => {
                    cc.tween(block)
                        .to(0.3, { x: targetX, y: targetY, scale: 1.0 }, { easing: 'backOut' })
                        .call(() => {
                            // re-add listener with correct new position
                            block.targetOff(this);
                            block.on(cc.Node.EventType.TOUCH_END, () => {
                                this.onBlockTapped(block, capturedCol, capturedRow);
                            }, this);
                            resolve();
                        })
                        .start();
                }));
            }
        }

        await Promise.all(scatterPromises);
    }

    private async checkGameState(): Promise<void> {
        if (this.score >= 500) {
            this.onWin();
            return;
        }
        if (this.moves <= 0) {
            this.onLose();
            return;
        }
        // only re-enable if game is still going
        this.setGridInteractable(true);
        await this.checkAndShuffle();
    }

    private onWin(): void {
        this.setGridInteractable(false);
        this.panelWin.active = true;
    }

    private onLose(): void {
        this.setGridInteractable(false);
        this.panelLose.active = true;
    }


    onLoad() {
        let currentY = this.initialY; // protect original value

        for (let i = 0; i < this.rows; i++) {
            this.generateElementsRow(i, this.cols, this.initialX, currentY, "x", this.xStepSize); // pass i
            currentY += this.yStepSize;
        }
        this.movesCount.getComponent(cc.Label).string = `${this.moves}`;
        this.checkAndShuffle();
    }

    // LIFE-CYCLE CALLBACKS:

    // onLoad() {
    //     // Теперь можешь использовать
    //     this.scoreCount.getComponent(cc.Label).string = "hui/500";
    // }

    start() {
        console.log("Grid:", this.grid);
    }

    // update (dt) {}
}
