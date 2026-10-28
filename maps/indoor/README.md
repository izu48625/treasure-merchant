# R5.32 — 描き込みを強化したTiled対応屋内マップ試作

## ブラウザで試す

GitHub Pages（mainから配信）で公開後：

- [試作マップを開く](https://izu48625.github.io/treasure-merchant/maps/indoor/demo.html)
- [既存の財宝ゲーム](https://izu48625.github.io/treasure-merchant/)

ホームの「探索」→「屋内ドット絵マップを試遊する」からもアクセス可能。**これは独立した試作品**です。装備、所持品、収益、市場、途中セーブなど本編の状態に干渉しません。

## Tiled Map Editorで編集する手順

1. このリポジトリをPCに取得する（GitHubの Download ZIP でも可）。
2. [Tiled Map Editor](https://www.mapeditor.org/download.html) をWindows PCにインストールする。
3. **`maps/indoor/indoor.tmj`** を Tiled の「File > Open」で開く。
4. `tiles/warehouse.tsj` に定義されたタイルを左の Tilesets から選択する。PNG は `tiles/warehouse.png`。96タイル（128×192px）へ拡張済み。3ファイルは相対配置のまま維持する。
5. `Floor` → 下地、`Patina` → 汚れ・血痕・破片、`Scars` → 旧汚れ・扉目印、`Walls` → 衝突壁、`Furniture` → 旧家具、`SetDressing` → 新しい小物や機材を編集。タイル番号10〜14、23〜32、65〜92には `solid=true` 属性がある。33〜64と93〜96は非衝突装飾。ブラウザの移動・敵の視線は壁と両家具レイヤーの判定を共通で使用する。
6. `Gameplay` オブジェクトレイヤーは `spawn`・`extract`・`loot`・`enemy`・`gate` という `type` とカスタムプロパティを持つ。マーカーを移動するとブラウザ側の位置も変わる。全マーカーは歩行可能な床の上に配置する。
7. `Atmosphere` オブジェクトレイヤーの `light` は `color`（#RRGGBB）と `radius`（ワールドpx）を、`sign` は `caption` と `color` を変更できる。これらはゲーム画面の照明や区画看板に反映される。
8. そのままJSONとして保存し、変更した `indoor.tmj` などをGitHubにコミット。ブラウザプレビューは同じファイルを読み込むので、JSに座標を手入力する必要はない。

### フォルダ構成

```text
maps/indoor/
  indoor.tmj              Tiledで編集できる有限直交マップ 48×38・16px
  map-template.js         初回配置を再生成する参考ソース（既存マップを上書きしないこと）
  tiles/warehouse.tsj     外部タイルセット、壁や家具のsolidプロパティ
  tiles/warehouse.png     旧32タイルを保持して64タイル追加、計96タイルの試作用ドット絵
  tiled-runtime.js        マップ/TSJの検証・描画・衝突・オブジェクト取得
  indoor-demo.js          独立したスマホ対応の試遊ロジック
  demo.html               ブラウザで遊べる試作ページ
```

## 試遊版でできること

- WASD・矢印キー・スマホ画面ドラッグで移動。
- 物資を調べる。黄・青・紫の期待度マーカーを表示（**本編のアイテムは取得しない**）。
- 敵6体が巡回・扇形の視認・近接追走攻撃する基本的な試遊。これらの敵AIは本編の `exploration.js` と共通ではない。
- 5分タイマー・HP・西側固定脱出口・全体地図・試遊リセット。
- 完全無料で、広告・実課金・外部画像読み込みはない。元のゲームは一切変更せず併存。

## 未実装・注意点

- **まだ本編の完全な探索システムには統合していない**。所持装備/戦闘武器/安全ポーチ/市場価値/出撃チェックポイント/鍵開け/警報/射撃はこの試遊版には未接続。
- 今回のドット絵アトラスは96種類の独自制作の一次素材。参考画像並みの高密度な人物・建物・床装飾は、アセットの拡張とグラフィック調整が必要。
- Tiled GUIでの開閉確認、正式な `node --test`、実機iPhone Safari表示、フレームレート、Pages配信後のE2Eテストは未実施。
- Tiled JSONと外部TSJ/Pngの形式は公式の [JSON Map Format](https://docs.mapeditor.org/en/latest/reference/json-map-format/) に合わせている。
- `tests/tiled-indoor.test.cjs` の13件、既存のV8模擬探索テスト132件、合計145件に成功（2026-10-28）。実機操作ではない。

## 次にやるとよいこと

この試作の部屋密度とタイルの質感が許容できるか確認 → 現在の本編を全面移行する前に、1部屋の物資開封・敵AI・鍵/射撃・脱出を共有エンジンへ段階的に移す。
