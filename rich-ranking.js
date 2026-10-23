'use strict';
// R4.4: annual snapshot from the original source. Values are NOT live updates.
// World: Forbes Australia, 2026-03-01; USD billions.
// Japan: Forbes JAPAN, 2026-05-22; JPY 100-million units (億円).
const RICH_WORLD_2026=[
 ['Elon Musk',839,'米国'],['Larry Page',257,'米国'],['Sergey Brin',237,'米国'],
 ['Jeff Bezos',224,'米国'],['Mark Zuckerberg',222,'米国'],['Larry Ellison',190,'米国'],
 ['Bernard Arnault & family',171,'フランス'],['Jensen Huang',154,'米国'],
 ['Warren Buffett',149,'米国'],['Amancio Ortega',148,'スペイン'],
 ['Rob Walton & family',146,'米国'],['Jim Walton & family',143,'米国'],
 ['Michael Dell',141,'米国'],['Alice Walton',134,'米国'],
 ['Steve Ballmer',126,'米国'],['Carlos Slim Helu & family',125,'メキシコ'],
 ['Changpeng Zhao',110,'カナダ'],['Michael Bloomberg',109,'米国'],
 ['Bill Gates',108,'米国'],['Francoise Bettencourt Meyers & family',100,'フランス'],
 ['Mukesh Ambani',99.7,'インド'],['Giancarlo Devasini',89.3,'イタリア'],
 ['Thomas Peterffy',82.9,'米国'],['Julia Koch & family',81.2,'米国'],
 ['Charles Koch & family',73.8,'米国'],['Zhang Yiming',69.3,'中国'],
 ['Zhong Shanshan',68.1,'中国'],['Jeff Yass',67.4,'米国'],
 ['Dieter Schwarz',67.2,'ドイツ'],['Germán Larrea Mota Velasco & family',67.1,'メキシコ']
];
const RICH_JAPAN_2026=[
 ['孫 正義',127000,'ソフトバンク'],['柳井 正',103000,'ファーストリテイリング'],
 ['滝崎武光',37600,'キーエンス'],['佐治信忠',14800,'サントリーHD'],
 ['関家一家',14500,'ディスコ'],['重田康光',9550,'光通信'],
 ['安田隆夫',7480,'パン・パシフィックHD'],['毒島秀行',7320,'SANKYO'],
 ['竹中統一',6360,'竹中工務店'],['森 章',6290,'森トラスト'],
 ['伊藤兄弟',6210,'セブン&アイHD'],['三木正浩',5890,'ABCマート'],
 ['三木谷浩史',5810,'楽天'],['高原豪久',5730,'ユニ・チャーム'],
 ['野田順弘',5250,'オービック'],['大塚裕司',5090,'大塚商会'],
 ['上月景正',5010,'コナミHD'],['小川一家',4930,'ゼンショーHD'],
 ['内山一家',4610,'レーザーテック'],['森一家',4300,'森ビル'],
 ['永守重信',4220,'ニデック'],['土屋嘉雄とその家族',4140,'ワークマン'],
 ['元谷一家',3980,'アパグループ'],['荒井正昭',3820,'オープンハウス'],
 ['似鳥昭雄',3740,'ニトリHD'],['多田勝美',3660,'大東建託'],
 ['襟川陽一・恵子',3500,'コーエーテクモHD'],['福嶋康博',3180,'スクウェア・エニックスHD'],
 ['金子文雄',3100,'大栄環境'],['石橋 寛',3020,'ブリヂストン']
];
const RICH_SOURCES={
 world:'https://www.forbes.com.au/news/billionaires/the-forbes-billionaires-list-top-200/',
 japan:'https://forbesjapan.com/feat/japanrich/'
};
let richRegion='world',titleView='titles';
function richTabsHTML(){return '<div class="rich-main-tabs"><button class="btn '+(titleView==='titles'?'primary':'')+'" data-title-view="titles">🏅 称号・実績</button><button class="btn '+(titleView==='wealth'?'primary':'')+'" data-title-view="wealth">🌍 長者ランキング</button></div>'}
function richListRows(){
 if(richRegion==='japan')return RICH_JAPAN_2026.map((x,i)=>({
  rank:i+1,name:x[0],where:x[2],local:x[1].toLocaleString('ja-JP')+'億円',
  // 1G=1USD, illustrative 1USD=159JPY; approximation only.
  value:BigInt(x[1])*100000000n/159n
 }));
 return RICH_WORLD_2026.map((x,i)=>({
  rank:i+1,name:x[0],where:x[2],local:x[1]+' billion USD',
  value:BigInt(Math.round(x[1]*10))*100000000n
 }));
}
function richRanking(){
 const rows=richListRows(),funds=net();
 const surpassed=rows.filter(x=>funds>=x.value).length;
 const next=rows.slice().reverse().find(x=>funds<x.value);
 const isJapan=richRegion==='japan';
 const src=isJapan?RICH_SOURCES.japan:RICH_SOURCES.world;
 const date=isJapan?'2026年5月22日の推計':'2026年3月1日の推計';
 return '<div class="rich-region-tabs">'+
  '<button class="btn '+(!isJapan?'primary':'')+'" data-rich-region="world">🌍 世界TOP30</button>'+
  '<button class="btn '+(isJapan?'primary':'')+'" data-rich-region="japan">🇯🇵 日本TOP30</button></div>'+
  '<section class="panel rich-summary"><div class="small">あなたの総資産</div>'+
  '<div class="money-big">'+short(funds)+'</div>'+
  '<div class="small">この上位30人・組のうち追い抜いた人数：<b>'+surpassed+' / 30</b></div>'+
  (next?'<p class="small">次の目標：'+esc(next.rank+'位 '+next.name)+'<br>目標まで <b>'+short(next.value-funds)+'</b></p>':
  '<p class="small">このTOP30をすべて超えました！</p>')+'</section>'+
  '<section class="panel"><div class="panelhead"><strong>'+ (isJapan?'日本':'世界')+'長者番付 TOP30</strong><span class="tiny">'+date+'</span></div>'+
  rows.map(x=>'<div class="rich-rank-row"><span class="rich-rank-no">'+x.rank+'位</span><div class="rich-rank-name"><b>'+esc(x.name)+'</b><small>'+esc(x.where)+'</small></div>'+
  '<div class="rich-rank-asset"><strong>'+esc(x.local)+'</strong><small>'+ (funds>=x.value?'✓ 到達':'あと '+short(x.value-funds))+'</small></div></div>').join('')+'</section>'+
  '<section class="panel"><strong>資料の出典・注意</strong><p class="small">'+date+'の固定値。株価や為替の変動を反映するリアルタイム番付ではありません。</p>'+
  '<p class="small">ゲーム内のみ便宜的に1G＝1米ドル、日本ランキングの円建て額を1ドル＝159円で参考換算して到達判定します。ゲーム内Gに現実の交換価値はありません。</p>'+
  '<p class="small">推定資産には家族・一族の資産が含まれる場合があります。非公式・非公認の比較表示であり、広告付き公開前にはデータ再利用条件を確認してください。</p>'+
  '<a class="btn smallbtn" href="'+src+'" target="_blank" rel="noopener noreferrer">Forbesの元データを見る ↗</a></section>';
}
