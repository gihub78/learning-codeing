const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);

app.use(express.static(__dirname));

let players = {};

io.on('connection', (socket) => {
    console.log('玩家连入:', socket.id);

    // 初始化玩家数据
    players[socket.id] = {
        id: socket.id,
        x: 800 + Math.random() * 400,
        y: 600 + Math.random() * 400,
        z: 0,
        hp: 100,
        superCharge: 100
    };

    // 同步当前所有玩家给新玩家
    socket.emit('currentPlayers', players);
    // 广播新玩家加入
    socket.broadcast.emit('newPlayer', players[socket.id]);

    // 处理移动
    socket.on('playerMovement', (moveData) => {
        if (players[socket.id]) {
            players[socket.id].x = moveData.x;
            players[socket.id].y = moveData.y;
            players[socket.id].z = moveData.z;
            socket.broadcast.emit('playerMoved', players[socket.id]);
        }
    });

    // 处理大招砸地伤害
    socket.on('dunkImpact', (impactData) => {
        socket.broadcast.emit('enemyDunked', { x: impactData.x, y: impactData.y });
        
        // 遍历所有玩家计算伤害
        Object.keys(players).forEach(id => {
            if (id !== socket.id) {
                let dist = Math.hypot(players[id].x - impactData.x, players[id].y - impactData.y);
                if (dist < 150) { // 攻击半径 150
                    players[id].hp -= 40;
                    
                    if (players[id].hp <= 0) {
                        // 死亡复活逻辑
                        players[id].hp = 100;
                        players[id].x = 800 + Math.random() * 400;
                        players[id].y = 600 + Math.random() * 400;
                        io.emit('playerRespawn', players[id]);
                    } else {
                        // 同步血量更新
                        io.emit('hpUpdate', { id: id, hp: players[id].hp });
                    }
                }
            }
        });
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

http.listen(3000, () => console.log('游戏已启动: http://localhost:3000'));
