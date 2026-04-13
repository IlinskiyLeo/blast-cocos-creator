const {ccclass, property} = cc._decorator;

@ccclass
export default class BlockData extends cc.Component {

    type: string = "normal"; // "normal" | "bomb" | "rocket_h" | "rocket_v"
    color: string = "";

    start () {

    }

    // update (dt) {}
}
