// اختبار سريع للباك إند: node test.js (السيرفر شغال على PORT)
const B='http://localhost:'+(process.env.PORT||3000);let ok=0;
const call=async(p,m='GET',b,t)=>{const r=await fetch(B+'/api'+p,{method:m,headers:{'Content-Type':'application/json',...(t?{Authorization:'Bearer '+t}:{})},body:b?JSON.stringify(b):undefined});return{s:r.status,d:await r.json()}};
const eq=(n,a,b)=>{if(a!==b){console.log('❌',n,a,'!=',b);process.exitCode=1}else{ok++;console.log('✅',n)}};
(async()=>{
const ph='0100'+Math.floor(1e6+Math.random()*9e6);
const A=await call('/login','POST',{phone:'admin',pass:'admin123',dev:'adm'});eq('admin login',A.s,200);const at=A.d.token;
eq('wrong pass',(await call('/login','POST',{phone:'admin',pass:'x',dev:'d'})).s,401);
eq('admin only',(await call('/admin/data','GET',null,null)).s,401);
const cid=(await call('/public')).d.courses[0].id;
eq('add student',(await call('/admin/user','POST',{name:'طالب اختبار',phone:ph,pass:'123456'},at)).s,200);
const S1=await call('/login','POST',{phone:ph,pass:'123456',dev:'deviceA'});eq('student login',S1.s,200);const st=S1.d.token,uid=S1.d.user.id;
eq('second device blocked',(await call('/login','POST',{phone:ph,pass:'123456',dev:'deviceB'})).s,403);
const c0=await call('/course/'+cid,'GET',null,st);eq('locked w/o enroll',c0.d.access,false);
const l1=c0.d.lessons[0].id,l2=c0.d.lessons[1].id;
eq('lesson denied w/o enroll',(await call('/lesson/'+l1,'GET',null,st)).s,403);
await call('/admin/enroll','POST',{uid,cid,on:true},at);
const L=await call('/lesson/'+l1,'GET',null,st);eq('lesson ok',L.s,200);eq('answers hidden',L.d.quiz[0].a,undefined);
eq('lesson2 locked',(await call('/lesson/'+l2,'GET',null,st)).s,403);
const inc=await call('/lesson/'+l1+'/submit','POST',{kind:'q',answers:[1,-1]},st);eq('incomplete rejected',inc.s,400);console.log('   →',inc.d.error);
const q=await call('/lesson/'+l1+'/submit','POST',{kind:'q',answers:[1,1]},st);eq('quiz graded',q.d.s,2);
eq('resubmit blocked',(await call('/lesson/'+l1+'/submit','POST',{kind:'q',answers:[1,1]},st)).s,409);
eq('lesson2 still locked (hw pending)',(await call('/lesson/'+l2,'GET',null,st)).s,403);
eq('hw graded',(await call('/lesson/'+l1+'/submit','POST',{kind:'h',answers:[0]},st)).d.s,1);
eq('lesson2 unlocked',(await call('/lesson/'+l2,'GET',null,st)).s,200);
eq('student cant use admin',(await call('/admin/data','GET',null,st)).s,403);
await call('/admin/user/'+uid+'/device','POST',{},at);eq('old token dead after device reset',(await call('/me','GET',null,st)).s,401);
eq('relogin new device',(await call('/login','POST',{phone:ph,pass:'123456',dev:'deviceB'})).s,200);
eq('support ticket',(await call('/support','POST',{name:'x',msg:'مشكلة'})).s,200);

// ---- المزايا الجديدة: شرح متعدد، PDF، مسودات، درجات، تواصل ----
const st2=(await call('/login','POST',{phone:ph,pass:'123456',dev:'deviceB'})).d.token;
const raw=async(p,b,t)=>{const r=await fetch(B+'/api'+p,{method:'POST',headers:{'Content-Type':'application/octet-stream',Authorization:'Bearer '+t},body:b});return{s:r.status,d:await r.json()}};
const pdf=await raw('/admin/upload-file?type=application%2Fpdf',Buffer.from('%PDF-1.4\n%%EOF'),at);eq('pdf upload',pdf.s,200);
eq('fake pdf rejected',(await raw('/admin/upload-file?type=application%2Fpdf',Buffer.from('hello world'),at)).s,400);
eq('pdf upload needs admin',(await raw('/admin/upload-file?type=application%2Fpdf',Buffer.from('%PDF-1.4'),st2)).s,403);
eq('unfinished question rejected',(await call('/admin/course','PUT',{title:'t',lessons:[{title:'x',quiz:[{q:'س',o:['1','2'],a:-1}],hw:[]}]},at)).s,400);
const C2=await call('/admin/course','PUT',{title:'كورس جديد',lessons:[{title:'ح1',items:[{type:'video',title:'v',url:'https://youtu.be/dQw4w9WgXcQ'},{type:'file',title:'f',url:pdf.d.url},{type:'file',title:'bad',url:'javascript:alert(1)'}],hw:[{q:'',img:'',o:['أ','ب'],a:0}],quiz:[{q:'',tag:'النحو',pts:3,o:['أ','ب','ج','د'],a:2}]}]},at);
eq('image-less empty question rejected',C2.s,400);
const C3=await call('/admin/course','PUT',{title:'كورس جديد',free:true,lessons:[{title:'ح1',items:[{type:'video',title:'v',url:'https://youtu.be/dQw4w9WgXcQ'},{type:'file',title:'f',url:pdf.d.url},{type:'file',title:'bad',url:'javascript:alert(1)'}],hw:[{q:'س؟',o:['أ','ب'],a:0}],quiz:[{q:'',img:'',tag:'النحو',pts:3,o:['أ','ب','ج','د'],a:2},{q:'ص',pts:2,o:['1','2'],a:1}].slice(1)}]},at);
eq('course with items saved',C3.s,200);eq('unsafe file url dropped',C3.d.lessons[0].items.length,2);
const lid=C3.d.lessons[0].id,cl=await call('/lesson/'+lid,'GET',null,st2);eq('student sees items',cl.d.items.length,2);eq('points exposed',cl.d.quiz[0].pts,2);
eq('draft saved',(await call('/lesson/'+lid+'/draft','POST',{kind:'q',answers:[1]},st2)).s,200);
eq('draft restored',(await call('/lesson/'+lid,'GET',null,st2)).d.draft.q[0],1);
eq('draft bad length',(await call('/lesson/'+lid+'/draft','POST',{kind:'q',answers:[1,1]},st2)).s,400);
const sq=await call('/lesson/'+lid+'/submit','POST',{kind:'q',answers:[1]},st2);eq('weighted score',sq.d.s+'/'+sq.d.t,'2/2');
eq('draft after submit blocked',(await call('/lesson/'+lid+'/draft','POST',{kind:'q',answers:[0]},st2)).s,409);
const sv=await call('/admin/settings','PUT',{social:{facebook:'https://facebook.com/x',instagram:'javascript:alert(1)',tiktok:'',youtube:'https://youtube.com/@x'},guideUrl:'https://youtu.be/dQw4w9WgXcQ',guideTitle:'تسليم'},at);
eq('social saved',sv.d.social.facebook,'https://facebook.com/x');eq('unsafe social dropped',sv.d.social.instagram,'');

// ---- تسجيل ببيانات كاملة + حد المشاهدات + رسالة ولي الأمر ----
{
const rp='0100'+Math.floor(1e6+Math.random()*9e6), pp='0111'+Math.floor(1e6+Math.random()*9e6);
const base={name:'طالب جديد',phone:rp,pass:'123456',dev:'dR',parentPhone:pp,gov:'القاهرة',school:'مدرسة السلام',grade:'الصف الثالث الثانوي'};
eq('register: missing parent phone',(await call('/register','POST',{...base,parentPhone:''})).s,400);
eq('register: parent = student phone',(await call('/register','POST',{...base,parentPhone:rp})).s,400);
eq('register: bad governorate',(await call('/register','POST',{...base,gov:'مدينة وهمية'})).s,400);
eq('register: bad grade',(await call('/register','POST',{...base,grade:'سنة غريبة'})).s,400);
eq('register: short school',(await call('/register','POST',{...base,school:'م'})).s,400);
const R1=await call('/register','POST',base);eq('register ok',R1.s,200);eq('profile saved',R1.d.user.gov+'|'+R1.d.user.parentPhone,'القاهرة|'+pp);
const rt=R1.d.token,ruid=R1.d.user.id;
eq('profile locked once set',(await call('/profile','POST',{parentPhone:pp,gov:'الجيزة',school:'xx',grade:'الصف الأول الثانوي'},rt)).s,403);
const FC=await call('/admin/course','PUT',{title:'كورس مشاهدات',free:true,price:0,lessons:[{title:'حصة محدودة',items:[{type:'video',title:'فيديو',url:'https://youtu.be/abc'},{type:'file',title:'ملزمة',url:'https://example.com/a.pdf'}],quiz:[],hw:[],maxViews:1}]},at);
const fl=FC.d.lessons[0].id;eq('maxViews saved',FC.d.lessons[0].maxViews,1);
const v0=await call('/lesson/'+fl,'GET',null,rt);eq('no count without ?view=1',v0.d.views.n,0);
const v1=await call('/lesson/'+fl+'?view=1','GET',null,rt);eq('first view counted',v1.d.views.n+'/'+v1.d.views.max,'1/1');eq('videos visible',v1.d.items.length,2);
const v2=await call('/lesson/'+fl+'?view=1','GET',null,rt);eq('reopen in window not recounted',v2.d.views.n,1);
const AD1=await call('/admin/data','GET',null,at);const nf=AD1.d.notifs.find(x=>x.uid===ruid);
eq('parent message queued',!!nf,true);eq('parent number intl format',nf&&nf.to,'20'+pp.slice(1));
eq('message has student & lesson',!!nf&&nf.text.includes('طالب جديد')&&nf.text.includes('حصة محدودة'),true);
eq('only one message for one view',AD1.d.notifs.filter(x=>x.uid===ruid).length,1);
await new Promise(r=>setTimeout(r,80));
const v3=await call('/lesson/'+fl+'?view=1','GET',null,rt);
if(v3.d.views.n===2)console.log('   (النافذة قصيرة في هذا التشغيل: بنختبر انتهاء المشاهدات)');
if(v3.d.views.n===1&&!v3.d.views.out)console.log('   ⏭ تخطي اختبار الانتهاء (شغّل السيرفر بـ VIEW_WINDOW_MIN=0.0001 لاختباره)');
else if(v3.d.views.n===1&&v3.d.views.out){eq('views exhausted → out',v3.d.views.out,true);eq('videos hidden when out',v3.d.items.map(i=>i.type).join(),'file');eq('quiz/hw still reachable when out',(await call('/lesson/'+fl,'GET',null,rt)).s,200);
  await call('/admin/views','POST',{uid:ruid,lid:fl,add:1},at);const v4=await call('/lesson/'+fl+'?view=1','GET',null,rt);eq('admin grants +1 view',v4.d.views.out,false)}
eq('student cant call admin views',(await call('/admin/views','POST',{uid:ruid},rt)).s,403);
await call('/admin/notifs/clear','POST',{},at);
await call('/admin/course/'+FC.d.id,'DELETE',null,at);
await call('/admin/user/'+ruid+'/delete','POST',{},at);
}
await call('/admin/course/'+C3.d.id,'DELETE',null,at);
await call('/admin/user/'+uid+'/delete','POST',{},at);
console.log(`\n${ok} اختبار نجح`)})();
