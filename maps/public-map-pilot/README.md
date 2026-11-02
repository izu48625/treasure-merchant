# R5.85 — 実在する公開Tiledマップを改造する独立試作

## 目的

「床・壁・棚をゼロから作る」のではなく、**無償で公開されている完成済みTiledマップ**と、その編集可能なタイルセットを入手し、少しアレンジする方法を検証する。本番V5を置き換える前に、改造後の画風や自由度を目で比較する。

## 今回使用した原本と権利

- 原本：[Tiled Resources / RPG/sample.tmx](https://github.com/mapeditor/tiled-resources/blob/master/RPG/sample.tmx)
- マップ作者・公開元：[Tiled Resources (mapeditor)](https://github.com/mapeditor/tiled-resources)
- 元画像の作者：Kenney / Kenney Vleugels。Kenney Roguelike Pack、CC0。
- ライセンス原文：`KENNEY_CC0_SOURCE_LICENSE.txt`。既存イラストと二次加工の商用利用、再配布がCC0で許可される。
- ソースファイル：`sample-original.tmx`、4種のオリジナル外部 `.tsx` と対応PNGを**そのまま保持**。
- 原本のサイズ：50列×50行、16×16px。元の5つのタイルレイヤーと障害物・屋根等の構成は変更しない。

最初に候補だった[Pixel Factory Interior Props Pack](https://synofplay.itch.io/pixel-factory-props-pack-free)は作者ページに `factory-interior-props.png` と `sample-scene.tmx` があることは確認したが、この環境から配布ファイル本体へのアクセスが成功しなかった。**このR5.85はPixel Factoryを取り込んだものではない**。誤ってそう説明しない。

## 実際の変更範囲

原本`sample-original.tmx`のコピー `sample-industrial-adapted.tmx` に限定して、次を追加した。

- マップ右下の `x=34..45`、`y=30..40` に新しい「Treasure Industrial Floor (sandbox)」タイルレイヤーを追加。132セルを原本と同じKenneyシートにある床GID 2558/2559/2616で仕上げた。
- 同区画に「Treasure Industrial Props (sandbox)」オブジェクトレイヤーを追加。元のKenney Indoorシートを再利用した保管棚・素材箱のスプライトオブジェクト10個（GID1495/1496/1497）。
- **元の5タイルレイヤー、元のobjectgroup、全firstgid、タイル画像は改変なし**。比較時に元のシーンを失わない。
- Tiledの実ファイルをブラウザで描画する `index.html` を追加。左は原本、右は改造版。表示範囲を「変更区画」と「50×50全体」で切り替え、枠線の表示も選べる。JavaScriptではTiled既存のzlib圧縮データをブラウザのDecompressionStreamで解凍。外部JSライブラリ不要。

## 検証対象と完了条件

1. Tiled Editorで原本と改造版を開け、元の5タイルレイヤーが完全に残っている。
2. GitHub Pagesで比較ページを開き、原本・変更後の両方を実際の素材で描画できる。
3. 16pxの画風が本編に適するか、人間の目で比較する。
4. 現状のV5（48×38、別のTiledファイル）とゲーム内の敵・宝箱・安全ポーチ・セーブ・金庫・カードキー・A/B帰還ルートには一切接続・変更しない。セーブ互換は本番統合前に再検証する。
5. `node --test tests/*.test.cjs` で既存回帰と追加の出典/レイヤー/PNG/JS構文テストが成功する。

**制限：** この公開マップはRPG・屋外要素を含み、現代倉庫の完成品ではない。工業施設風の132タイルと10棚を重ねた実験であって、まだ通路の衝突、敵の視線、5分制限、金庫や帰還システムは移植していない。iPhone Safariの画質・操作実測も未実施。合わなければ採用しない。

## 試作URL

- [公開マップ新旧比較](https://izu48625.github.io/treasure-merchant/maps/public-map-pilot/index.html)
- [既存本編R5.84](https://izu48625.github.io/treasure-merchant/?v=R5.84)

## 今後の選択肢

- 公開マップの建物構造を維持したまま、財宝ゲームの工業施設に合う区画だけを別マップへ転用。
- ファンタジー風と現在のゲームの絵柄が合わなければ、この試作は不採用。CC0の別の現代/工場系Tiledサンプルを試す。
- Pixel Factoryの正規の2配布ファイルを利用できるようになった場合は、それをこの試作と比較。配布元・使用権を別に明記し、Pixel Factoryのサンプルであるかを混同しない。
