const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 8080;
const PUBLIC = path.join(__dirname, 'public');
const rooms = new Map();
const clients = new Map();

function cleanName(s){return String(s||'Bạn').replace(/[<>]/g,'').slice(0,24)||'Bạn';}
function cleanCode(s){return String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);}
function frame(text){const data=Buffer.from(text);const len=data.length;let h;if(len<126)h=Buffer.from([0x81,len]);else if(len<65536){h=Buffer.alloc(4);h[0]=0x81;h[1]=126;h.writeUInt16BE(len,2);}else{h=Buffer.alloc(10);h[0]=0x81;h[1]=127;h.writeBigUInt64BE(BigInt(len),2);}return Buffer.concat([h,data]);}
function pong(){return Buffer.from([0x8A,0]);}
function closeFrame(){return Buffer.from([0x88,0]);}
function send(c,obj){if(!c||c.socket.destroyed)return;try{c.socket.write(frame(JSON.stringify(obj)));}catch{}}
function broadcast(room,obj){for(const id of room.players.keys()){const c=clients.get(id);if(c)send(c,obj);}}
function snapshot(room){return [...room.players.values()].map(p=>({id:p.id,name:p.name,score:p.score,progress:p.progress,submitted:p.submitted}));}
function roomState(room){return {code:room.code,hostId:room.hostId,started:room.started,examId:room.examId,players:snapshot(room)};}
function makeCode(){const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let code;do{code='';for(let i=0;i<6;i++)code+=chars[Math.floor(Math.random()*chars.length)];}while(rooms.has(code));return code;}

const server=http.createServer((req,res)=>{
  let pathname=decodeURIComponent((req.url||'/').split('?')[0]);if(pathname==='/')pathname='/index.html';
  const file=path.normalize(path.join(PUBLIC,pathname));
  if(!file.startsWith(PUBLIC)){res.writeHead(403);return res.end('Forbidden');}
  fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);return res.end('Not found');}
    const ext=path.extname(file);const type={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'}[ext]||'application/octet-stream';
    res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});res.end(data);
  });
});

function acceptWebSocket(req,socket){
  const key=req.headers['sec-websocket-key'];if(!key){socket.destroy();return;}
  const accept=crypto.createHash('sha1').update(key+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+accept+'\r\n\r\n');
  const id=crypto.randomUUID();const c={id,socket,room:null,name:'Bạn',buffer:Buffer.alloc(0)};clients.set(id,c);send(c,{type:'connected',id});
  socket.on('data',chunk=>{
    c.buffer=Buffer.concat([c.buffer,chunk]);
    while(true){
      if(c.buffer.length<2)break;
      const b0=c.buffer[0],b1=c.buffer[1];const opcode=b0&15;const masked=!!(b1&128);let len=b1&127,offset=2;
      if(len===126){if(c.buffer.length<4)break;len=c.buffer.readUInt16BE(2);offset=4;}
      else if(len===127){if(c.buffer.length<10)break;const big=c.buffer.readBigUInt64BE(2);if(big>BigInt(10_000_000)){socket.destroy();return;}len=Number(big);offset=10;}
      if(!masked||c.buffer.length<offset+4+len)break;
      const mask=c.buffer.subarray(offset,offset+4);offset+=4;const payload=Buffer.alloc(len);
      for(let i=0;i<len;i++)payload[i]=c.buffer[offset+i]^mask[i%4];
      c.buffer=c.buffer.subarray(offset+len);
      if(opcode===8){socket.end(closeFrame());return;}
      if(opcode===9){socket.write(pong());continue;}
      if(opcode!==1)continue;
      let msg;try{msg=JSON.parse(payload.toString('utf8'));}catch{continue;}handle(c,msg);
    }
  });
  socket.on('close',()=>disconnect(c));socket.on('error',()=>disconnect(c));
}

function disconnect(c){if(!clients.has(c.id))return;const room=rooms.get(c.room);if(room){room.players.delete(c.id);broadcast(room,{type:'system',message:`${c.name} đã rời phòng.`,state:roomState(room)});if(room.players.size===0)rooms.delete(room.code);else{room.hostId=room.players.keys().next().value;room.started=false;broadcast(room,{type:'room',state:roomState(room)});}}clients.delete(c.id);}
function handle(c,msg){
  if(msg.type==='hello'){c.name=cleanName(msg.name);return;}
  if(msg.type==='create'){if(c.room)return;const code=makeCode();const room={code,hostId:c.id,started:false,examId:null,players:new Map()};room.players.set(c.id,{id:c.id,name:c.name,score:0,progress:0,submitted:false});rooms.set(code,room);c.room=code;send(c,{type:'room',state:roomState(room)});return;}
  if(msg.type==='join'){const code=cleanCode(msg.code),room=rooms.get(code);if(!room)return send(c,{type:'error',message:'Không tìm thấy phòng '+code+'.'});if(room.started)return send(c,{type:'error',message:'Trận đấu đã bắt đầu.'});if(room.players.size>=2)return send(c,{type:'error',message:'Phòng đã đủ 2 người.'});if(c.room)return send(c,{type:'error',message:'Bạn đang ở phòng khác.'});c.room=code;room.players.set(c.id,{id:c.id,name:c.name,score:0,progress:0,submitted:false});broadcast(room,{type:'room',state:roomState(room)});broadcast(room,{type:'system',message:`${c.name} đã vào phòng.`});return;}
  const room=rooms.get(c.room);if(!room)return;
  if(msg.type==='chat'){const text=String(msg.text||'').trim().slice(0,500);if(text)broadcast(room,{type:'chat',name:c.name,text});return;}
  if(msg.type==='start'){if(room.hostId!==c.id)return;if(room.players.size!==2)return send(c,{type:'error',message:'Cần đủ 2 người thật mới bắt đầu được.'});room.started=true;room.examId=String(msg.examId||'');for(const p of room.players.values()){p.score=0;p.progress=0;p.submitted=false;}broadcast(room,{type:'started',state:roomState(room)});return;}
  if(msg.type==='progress'){const p=room.players.get(c.id);if(!p)return;p.progress=Math.max(0,Math.min(100,Number(msg.progress)||0));p.score=Math.max(0,Number(msg.score)||0);broadcast(room,{type:'players',players:snapshot(room)});return;}
  if(msg.type==='submit'){const p=room.players.get(c.id);if(!p)return;p.submitted=true;p.score=Math.max(0,Number(msg.score)||0);p.progress=100;broadcast(room,{type:'players',players:snapshot(room)});if([...room.players.values()].every(x=>x.submitted)){const arr=[...room.players.values()].sort((a,b)=>b.score-a.score);broadcast(room,{type:'finished',winnerId:arr[0].score===arr[1].score?null:arr[0].id,players:snapshot(room)});room.started=false;}return;}
}

server.on('upgrade',(req,socket)=>{if(req.headers.upgrade?.toLowerCase()!=='websocket'){socket.destroy();return;}acceptWebSocket(req,socket);});
server.listen(PORT,()=>console.log('MathArena multiplayer: http://localhost:'+PORT));
