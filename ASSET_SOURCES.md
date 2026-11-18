# 2026-11-16 DuelTools reference pass

Reference supplied by the user: `DuelTools(64bit,_Android7).apk`.
Static resource inspection only. The APK was not installed or executed.

The APK contains blue/cyan and black/silver UI variants, angular panel borders, bold slanted LP digits, blue calculator keys, gold/red coin frames, 32 audio clips including short effects and long music tracks.

The six short sounds in `dist/audio/` are converted from user-provided Unity AudioClip assets in sharedassets0.assets:
- tap.wav: 162 numbutton
- start.wav: 174 duel
- life.wav: 185 life
- coin.wav: 172 coin
- dice.wav: 178 dice
- turn.wav: 183 linkfinish

Conversion: mono 22.05 kHz PCM16 WAV, a short tail fade; no background music or character voice/music assets included. These are source-provided effects, not newly authored or declared open source.

The shipped UI geometry is newly authored CSS/SVG inspired by the cyan variant, not extracted UI textures. The numeric font is newly drawn segment geometry. Except for the explicitly requested coin/dice assets listed below, APK textures, extracted fonts and full resource files remain outside the site checkout.

## Coin and dice artwork follow-up

At the user's explicit request, `dist/art/dueltools/` includes two original coin faces, six dice faces and five dice rolling frames (13 PNGs). They were copied without pixel changes from the supplied APK; exact Unity Texture2D IDs are listed in `sources.json`. These are reference-provided assets, not newly authored or declared open source. Browser CSS animates the original coin faces and dice frame sequence. Game rules, random generation and result persistence are unchanged.


## Riftbound reference (2026-11-16)

Two user-supplied mini-program screenshots inform the face-to-face score and experience layout, navy/blue panels and gold emphasis. Riftbound geometry, coin and dice SVG artwork and CSS animations are newly authored in rift.mjs/rift.css. Reference screenshots are not shipped in dist; DuelTools coin/dice PNGs remain specific to Yu-Gi-Oh.


## 符文骰子更新（2026-11-16）

符文战场准备页改为掷骰子；开局与对局骰子采用六面CSS翻滚、减速和落定动画（1.12秒），支持减少动态效果。1点为原创金色几何符文，2～6保留圆点，弹窗仍显示数字。没有新增图像库或第三方素材。游戏王随机工具不变。44项现有测试通过，浏览器核对结果4、符文1与记录一致。


Riftbound coin update: original SVG rings, markings and face labels; gold head and blue tail, CSS two-sided flip with a thin edge. No external coin images or additional libraries.


2026-11-16 硬币符文面：符文战场硬币面上的正/反文字改为原创几何符文。金色正面为单枚菱形符文，深蓝反面为对称双翼符文；下方正面/反面结果文字保留。仅修改SVG图案及其配色，动画、重抛、随机、记录、游戏王均不变。语法检查通过，浏览器验证正反两面及再次抛投，控制台无错误。
# 宝可梦首版几何素材（2026-11-16）

dist/pokemon.mjs 中硬币的闪电/圆环图案和骰子圆点为本项目原创SVG几何图形，CSS负责旋转落定反馈。没有引入宝可梦角色图片、外部字体或游戏王/符文战场图案。

2026-11-17 宝可梦球形素材更新：按用户要求，以SVG圆、半圆和圆环绘制精灵球风格硬币及1点骰面；正面红白、反面蓝白双红纹。六面骰及双面硬币由CSS实现空间翻转，无新增外部图片、字体或库。

- 2026-11-17 音量试听复用现有 `dist/audio/tap.wav`（约 261 ms），独立播放器并受主音量控制，来源与既有按钮音效相同；未新增外部音频素材。

## 统一主菜单几何素材（2026-11-17）

`dist/home.mjs` 中三款游戏的主菜单标识、背景纹样和入场角色均为本项目新绘制的原生 SVG 几何：符文拳套、游戏王风格几何卡片、红白球体及其碰撞／碎裂／开启效果。样式与 800ms 动画由 `dist/home.css` 实现；没有复制外部图片、字体、角色素材，也没有新增框架、图库或其他第三方资源。既有冻结设计文件与 DuelTools 来源资产未修改。

