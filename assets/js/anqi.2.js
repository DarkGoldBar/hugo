const apiURL = "wss://fxyfyu1ivj.execute-api.ap-northeast-1.amazonaws.com/Prod";
const dchat = new DchatClient(apiURL, "anqi");
const urlParams = new URLSearchParams(window.location.search);
const pieceNames = ["将", "士", "象", "车", "马", "炮", "兵", "帅", "仕", "相", "车", "马", "炮", "卒"];

const exampleData = [
    [0, 1], [13, 1], [5, 1], [10, 1], [2, 0], [8, 1], [3, 0], [-1, -1],
    [1, 0], [5, 0], [12, 1], [6, 0], [6, 0], [2, 1], [6, 0], [5, 1],
    [1, 0], [8, 0], [8, 0], [9, 0], [9, 0], [11, 1], [10, 0], [11, 0],
    [2, 0], [3, 1], [2, 1], [9, 1], [-1, -1], [13, 0], [13, 0], [-1, -1]
];

const ZeroData = [
    [0, 0], [0, 0], [5, 0], [0, 0], [2, 0], [8, 0], [3, 0], [0, 0],
    [1, 0], [5, 0], [0, 0], [6, 0], [6, 0], [2, 0], [6, 0], [5, 0],
    [1, 0], [8, 0], [8, 0], [9, 0], [9, 0], [0, 0], [0, 0], [0, 0],
    [2, 0], [3, 0], [2, 0], [9, 0], [0, 0], [0, 0], [0, 0], [0, 0]
];

const gamestate = {
    board: ZeroData,
    turn_position: 0,  // 0:无人 1:左 2:右
    gameover: 0,
    cols: 4,
    last_move: [-1, -1],
    left_color: "none",
    right_color: "none",
    left_eat: [],
    right_eat: [],
};

document.addEventListener('DOMContentLoaded', function() {
    const cancelButton = document.querySelector("#cancel-button");
    cancelButton.disabled = true;
    cancelButton.addEventListener("click", function() {
        clearBoardHighlights();
        cancelButton.disabled = true;
    });
    
    const resetButton = document.querySelector("#reset-button");
    resetButton.addEventListener("click", function() {
        dchat.send(JSON.stringify({
            action: "anqi-reset",
        }));
        resetButton.disabled = true;
    });

    const dogButton = document.querySelector("#dog-button");
    dogButton.addEventListener("click", function() {
        dchat.send(JSON.stringify({
            action: "anqi-dog",
        }));
        dogButton.disabled = true;
    });


    dchat.login(0, 0, parseInt(urlParams.get('position')));
    dchat.connect();

    dchat.handler.setMessageHandler('leave', (messageData) => {
        dchat.room.members = dchat.room.members.filter(mem => (!(mem.uuid == messageData.uuid)));
        updateUserList();
    });
    
    dchat.handler.setMessageHandler('join', (messageData) => {
        const new_member = {
            uuid: messageData.uuid,
            nickname: messageData.nickname,
            online: 1,
            position: messageData.position,
        }
        const existFlag = dchat.room.members.some(m => m.uuid === new_member.uuid);
        if (!existFlag) {
            dchat.room.members.push(new_member);
            updateUserList();
        }
    });
    
    dchat.handler.setMessageHandler('text', (messageData) => {
        dchat.room.messages.push(messageData);
        console.log(messageData);
    });
    
    dchat.handler.setMessageHandler('reload', (messageData) => {
        dchat.room.members = messageData.members;
        dchat.room.messages = messageData.messages;
        if (messageData.messages[0]) {
            const gs = JSON.parse(messageData.messages[0]);
            updateGame(gs);
            updateUserList();
        }
    });
    
    dchat.handler.setMessageHandler('anqi-update', (messageData) => {
        updateGame(messageData.gamestate);
    });
    
    dchat.handler.setMessageHandler('disconnect', (messageData) => {
        displayFullScreamDialog("服务器关闭连接", `原因: ${messageData.reason}`)
    });

    updateGame();
    updateUserList();
});

function sendMoveToServer(fromIndex, toIndex) {
    console.log(`Move from ${fromIndex} to ${toIndex}`);
    dchat.send(JSON.stringify({
        action: "anqi-move",
        move: [fromIndex, toIndex],
    }));
}

function updateGame(gs) {
    if (gs) {
        Object.assign(gamestate, gs);
    }
    // turn_position: 0, 1, 2
    const turnPlayerDiv = document.getElementById("turn-player");
    const turnPlayerSpan = turnPlayerDiv.getElementsByTagName("span")[0];
    turnPlayerSpan.innerHTML = gamestate.turn_position;
    if (gamestate.turn_position) {
        const resetButton = document.querySelector("#reset-button");
        resetButton.disabled = true;
    }
    // gameover: 0, 1
    const gameoverDiv = document.getElementById("gameover");
    gameoverDiv.style.display = gamestate.gameover === 1 ? "block" : "none";

    // board, last_move
    let setClick = 0;
    const dogButton = document.querySelector("#dog-button");
    if (gamestate.turn_position === dchat.member.position) {
        if (gamestate.turn_position === 1) {
            if (gamestate.left_color === "none") {
                setClick = 3;
            } else if (gamestate.left_color === "red") {
                setClick = 1;
            } else if (gamestate.left_color === "black") {
                setClick = 2;
            }
        } else {
            if (gamestate.right_color === "none") {
                setClick = 3;
            } else if (gamestate.right_color === "red") {
                setClick = 1;
            } else if (gamestate.right_color === "black") {
                setClick = 2;
            }
        }
        dogButton.disabled = true;
    } else {
        dogButton.disabled = !gamestate.can_dog;
    }
    displayBoard(gamestate.board, setClick, gamestate.last_move);

    // left_color, right_color, left_eat, right_eat
    const member1 = dchat.room.members.find(member => member.position === 1);
    const member2 = dchat.room.members.find(member => member.position === 2);
    displaySide(gamestate, "left", (member1? member1.nickname : 'player1'));
    displaySide(gamestate, "right", (member2? member2.nickname : 'player2'));
}


function displayBoard(boardData, setClick, lastMove) {
    const board = document.getElementById("board");
    board.innerHTML = "";

    boardData.forEach((item, index) => {
        const chess = createChess(item[0], item[1], index, setClick);
        board.appendChild(chess);
    });

    if (lastMove[0] !== -1) {
        createHighlightYellow(lastMove[0])
    }
    if (lastMove[1] !== lastMove[0]) {
        createHighlightYellow(lastMove[1])
    }
}


function displaySide(gamestate, side, nickname) {
    const sideName = document.getElementById(`${side}-name`);
    const sideColor = document.getElementById(`${side}-color`);
    const sideEat = document.getElementById(`${side}-eat`);

    sideName.innerHTML = `<div class="user-item">${nickname}</div>`;

    let colorClass = "back";
    let colorTitle = "";
    if (gamestate[`${side}_color`] === "red") {
        colorClass = "red"
        colorTitle = "红"
    }
    if (gamestate[`${side}_color`] === "black") {
        colorClass = "black"
        colorTitle = "黑"
    }
    sideColor.innerHTML = `<div class="chess wide ${colorClass}"><div class="chess-contents">${colorTitle}</div></div>`;

    sideEat.innerHTML = "";
    gamestate[`${side}_eat`].forEach(item => {
        const chess = createChess(item[0], item[1]);
        chess.classList.add("small");
        sideEat.appendChild(chess);
    });
}


function createChess(piece, flipped, index, setClick) {
    const chess = document.createElement("div");
    chess.className = "chess";
    const chessCont = document.createElement("div");
    chessCont.className = "chess-contents";
    chess.appendChild(chessCont);

    let canClick = 0;
    if (piece === -1) {
        canClick = 0;
    } else if (flipped === 0) {
        chess.classList.add("back");
        canClick = 3;
    } else {
        chessCont.textContent = pieceNames[piece];
        if (piece < 7) {
            chess.classList.add("red");
            canClick = 1;
        } else {
            chess.classList.add("black");
            canClick = 2;
        }
    }

    if (index !== undefined) {
        chess.setAttribute("data-id", index);
        if (canClick & setClick) {
            chessCont.addEventListener("click", function () {
                handlePieceClick(index);
            });
        }
    }

    return chess;
}

 
function handlePieceClick(index) {
    const pieceData = gamestate["board"][index];
    const pieceType = pieceData[0];
    const flipped = pieceData[1];
    const r = gamestate.cols;
    const potentialMoves = [-r, r, -1, 1];

    clearBoardHighlights();
    const cancelButton = document.querySelector("#cancel-button");
    cancelButton.disabled = false;

    if (flipped === 0) {
        // 未翻开
        createHighlight(index, index);
    } else if (flipped === 1 && (pieceType % 7 === 5)) {
        // 炮
        potentialMoves.forEach(step => {
            checkValidPaoMove(index, step);
        });
    // } else if (flipped === 1 && (pieceType % 7 === 3)) { 
    //     // 车
    //     potentialMoves.forEach(step => {
    //         checkValidJuMove(index, step);
    //     });
    } else if (flipped === 1) { 
        // 一般棋子
        potentialMoves.forEach(step => {
            if (checkValidMove(index, index + step)) {
                createHighlight(index, index + step);
            }
        });
    }
}


function checkValidPaoMove(fromIndex, step) {
    let toIndex = fromIndex + step;
    let i = 1;
    let mounts = 0;
    const r = gamestate.cols;
    while (toIndex >= 0 && toIndex < 32) {
        if ((Math.floor(fromIndex / r) !== (Math.floor(toIndex / r))) && (Math.abs(step) === 1)) {
            return;
        }
        if (gamestate.board[toIndex][0] === -1) {
            if (i === 1) {
                createHighlight(fromIndex, toIndex);
            };
        } else { 
            mounts = 0;
            for (let j=1; j<i; j++) {
                if (!(gamestate.board[fromIndex + j * step][0] === -1)) {
                    mounts += 1;
                }
            }
            if (mounts === 1) {
                if (gamestate.board[toIndex][1] === 0) {
                    createHighlight(fromIndex, toIndex);
                } else if (((gamestate.board[fromIndex][0] < 7) ^ (gamestate.board[toIndex][0] < 7))) {
                    createHighlight(fromIndex, toIndex);
                }
            } else if (mounts > 1){
                return;
            }
        }
        i += 1;
        toIndex += step;
    }
}

function checkValidJuMove(fromIndex, step) {
    let toIndex = fromIndex + step;
    let i = 1;
    const r = gamestate.cols;
    while (toIndex >= 0 && toIndex < 32) {
        if ((Math.floor(fromIndex / r) !== (Math.floor(toIndex / r))) && (Math.abs(step) === 1)) {
            return;
        } else if (gamestate.board[toIndex][0] === -1) {
            createHighlight(fromIndex, toIndex);
        } else {
            if (checkValidMove(fromIndex, toIndex)) {
                createHighlight(fromIndex, toIndex);
            }
            return;
        }
        i += 1;
        toIndex += step;
    }
}

function checkValidMove(fromIndex, toIndex) {
    const r = gamestate.cols;
    let st = gamestate.board[fromIndex][0];
    let et = gamestate.board[toIndex][0];

    if (toIndex < 0 || toIndex >= 32) {
        return false;
    }
    if ((Math.floor(fromIndex / r) !== (Math.floor(toIndex / r))) && ((fromIndex % r) !== (toIndex % r))) {
        return false;
    }
    if (et === -1) { // 目标为空
        return true;
    } else if (gamestate.board[toIndex][1] === 0) { // 目标未翻开
        return false;
    } else if (!((st < 7) ^ (et < 7))) { // 同色
        return false;
    }
    st = st % 7;
    et = et % 7;
    if ((st == 6) && (et == 0)) {
        return true;
    } else if ((st == 0) && (et == 6)){
        return false;
    } else if (st <= et){
        return true;
    }
    return false;
}

function createHighlight(fromIndex, toIndex) {
    const chess = document.querySelector(`#board [data-id="${toIndex}"]`);
    if (chess) {
        const highlight = document.createElement("div");
        highlight.className = "highlight";
        chess.appendChild(highlight);
        highlight.addEventListener("click", function moveHandler() {
            clearBoardHighlights();
            sendMoveToServer(fromIndex, toIndex); // 向服务器发送移动数据
        })
    }
}

function createHighlightYellow(index) {
    const chess = document.querySelector(`#board [data-id="${index}"]`);
    if (chess) {
        const highlight = document.createElement("div");
        highlight.className = "highlight yellow";
        chess.appendChild(highlight);
    }
}

function clearBoardHighlights() {
    document.querySelectorAll("#board .highlight").forEach(highlight => {
        highlight.remove();
    });
    const cancelButton = document.querySelector("#cancel-button");
    cancelButton.disabled = true;
}


function createMemberElement(member) {
    const ele = document.createElement('div');
    ele.className = 'user-item';
    ele.title = member.uuid;
    if (member.position !== 0) {
        const posEle = document.createElement("span");
        posEle.className = "position";
        posEle.textContent = member.position;
        ele.appendChild(posEle);
    }
    const nameEle = document.createElement("span");
    nameEle.textContent = member.nickname;
    ele.appendChild(nameEle);
    return ele
}


function updateUserList() {
    const memberList = document.getElementById('user-list');
    let ele;
    memberList.innerHTML = '';
    
    const selfEle = createMemberElement(dchat.member);
    selfEle.classList.add("self")
    memberList.appendChild(selfEle);
    
    dchat.room.members.forEach(mem => {
        if (mem.uuid !== dchat.member.uuid) {
            ele = createMemberElement(mem);
            memberList.appendChild(ele);
        }
    });
}
