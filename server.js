const express=require("express"), path=require("path"), fs=require("fs"), multer=require("multer"), Database=require("better-sqlite3");
const app=express(), PORT=process.env.PORT||3000;
const dataDir=path.join(__dirname,"data"), uploadDir=path.join(__dirname,"public","uploads");
fs.mkdirSync(dataDir,{recursive:true}); fs.mkdirSync(uploadDir,{recursive:true});
const db=new Database(path.join(dataDir,"starok.db"));
db.exec(`CREATE TABLE IF NOT EXISTS admins(id INTEGER PRIMARY KEY AUTOINCREMENT,email TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS products(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,game TEXT NOT NULL,price REAL NOT NULL,stock INTEGER DEFAULT 0,image TEXT,description TEXT DEFAULT '',active INTEGER DEFAULT 1,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY AUTOINCREMENT,customer_name TEXT,contact TEXT,player_id TEXT,product_id INTEGER,product_name TEXT,price REAL,status TEXT DEFAULT 'new',created_at TEXT DEFAULT CURRENT_TIMESTAMP);`);
if(!db.prepare("SELECT 1 FROM products LIMIT 1").get()) db.prepare("INSERT INTO products(name,game,price,stock,description) VALUES(?,?,?,?,?)").run("مثال: 60 UC","PUBG Mobile",1,100,"احذف هذا المنتج وأضف منتجاتك من لوحة الإدارة.");
const crypto=require("crypto");
const ADMIN_EMAIL=process.env.ADMIN_EMAIL||"admin@starok.local";
const ADMIN_PASSWORD=process.env.ADMIN_PASSWORD||"ChangeMe123!";
if(!db.prepare("SELECT 1 FROM admins LIMIT 1").get()){
  const hash=crypto.createHash("sha256").update(ADMIN_PASSWORD).digest("hex");
  db.prepare("INSERT INTO admins(email,password_hash) VALUES(?,?)").run(ADMIN_EMAIL,hash);
}
function auth(req,res,next){
  const token=(req.headers.authorization||"").replace("Bearer ","");
  const expected=process.env.ADMIN_TOKEN||crypto.createHash("sha256").update(ADMIN_EMAIL+ADMIN_PASSWORD).digest("hex");
  if(token!==expected) return res.status(401).json({error:"غير مصرح"});
  next();
}
const upload=multer({storage:multer.diskStorage({destination:uploadDir,filename:(r,f)=>Date.now()+"-"+f.originalname.replace(/[^a-zA-Z0-9._-]/g,"_")})});
app.use(express.json()); app.use(express.urlencoded({extended:true})); app.use(express.static(path.join(__dirname,"public")));
app.get("/api/products",(req,res)=>res.json(db.prepare("SELECT * FROM products WHERE active=1 ORDER BY id DESC").all()));
app.get("/api/admin/products",auth,(req,res)=>res.json(db.prepare("SELECT * FROM products ORDER BY id DESC").all()));
app.post("/api/admin/products",auth,upload.single("image"),(req,res)=>{let {name,game,price,stock,description}=req.body;if(!name||!game||price==="")return res.status(400).json({error:"الاسم واللعبة والسعر مطلوبة"});let image=req.file?"/uploads/"+req.file.filename:"";let info=db.prepare("INSERT INTO products(name,game,price,stock,image,description) VALUES(?,?,?,?,?,?)").run(name,game,Number(price),Number(stock||0),image,description||"");res.json({id:info.lastInsertRowid})});
app.put("/api/admin/products/:id",auth,upload.single("image"),(req,res)=>{let p=db.prepare("SELECT * FROM products WHERE id=?").get(req.params.id);if(!p)return res.sendStatus(404);let image=req.file?"/uploads/"+req.file.filename:p.image;let {name,game,price,stock,description,active}=req.body;db.prepare("UPDATE products SET name=?,game=?,price=?,stock=?,description=?,active=?,image=? WHERE id=?").run(name,game,Number(price),Number(stock||0),description||"",active===undefined?p.active:Number(active),image,p.id);res.json({ok:true})});
app.delete("/api/admin/products/:id",auth,(req,res)=>{db.prepare("DELETE FROM products WHERE id=?").run(req.params.id);res.json({ok:true})});
app.post("/api/orders",(req,res)=>{let {customer_name,contact,player_id,product_id}=req.body;let p=db.prepare("SELECT * FROM products WHERE id=? AND active=1").get(product_id);if(!p)return res.status(400).json({error:"المنتج غير موجود"});if(p.stock<1)return res.status(400).json({error:"المنتج غير متوفر"});let info=db.prepare("INSERT INTO orders(customer_name,contact,player_id,product_id,product_name,price) VALUES(?,?,?,?,?,?)").run(customer_name,contact,player_id,p.id,p.name,p.price);db.prepare("UPDATE products SET stock=stock-1 WHERE id=?").run(p.id);res.json({id:info.lastInsertRowid})});
app.get("/api/admin/orders",auth,(req,res)=>res.json(db.prepare("SELECT * FROM orders ORDER BY id DESC").all()));
app.patch("/api/admin/orders/:id",auth,(req,res)=>{db.prepare("UPDATE orders SET status=? WHERE id=?").run(req.body.status,req.params.id);res.json({ok:true})});
app.get("/api/admin/stats",auth,(req,res)=>res.json({products:db.prepare("SELECT COUNT(*) n FROM products").get().n,orders:db.prepare("SELECT COUNT(*) n FROM orders").get().n,sales:db.prepare("SELECT COALESCE(SUM(price),0) n FROM orders").get().n}));
app.post("/api/login",(req,res)=>{let {email,password}=req.body;let hash=crypto.createHash("sha256").update(password||"").digest("hex");let a=db.prepare("SELECT * FROM admins WHERE email=? AND password_hash=?").get(email,hash);if(!a)return res.status(401).json({error:"بيانات الدخول غير صحيحة"});let token=process.env.ADMIN_TOKEN||crypto.createHash("sha256").update(ADMIN_EMAIL+ADMIN_PASSWORD).digest("hex");res.json({token})});
app.listen(PORT,()=>console.log("STAR OK running on http://localhost:"+PORT));