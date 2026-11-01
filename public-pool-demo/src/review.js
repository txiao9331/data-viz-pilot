// Content changes invalidate old evidence. This record describes the current
// month-driven continuous-line replay, not the earlier point-particle version.
export const review = {
  status: 'passed',
  checks: [
    {
      name: '场景初始化、材质名称与编辑视野',
      status: 'passed',
      evidence: '最终代码在离屏 Edit3D 中初始化成功；sceneLint 返回空数组，framingReport.ok = true。既有网格材质、单点核心、发散粒子 Points 材质和两种独立 LineSegments 线迹材质均有非空中文用途名称；粒子群核心及其材质引用已移除。particle_emission 注册成功。',
    },
    {
      name: '最近一个月真实日汇总驱动',
      status: 'passed',
      evidence: '2026-08-20 至 2026-09-18 共 30 天的静息心率、血氧和压力映射到 50 秒；睡眠不参与。HUD 明示连续变化与空间路径为模拟，未把日汇总插值伪装成真实逐秒观展数据。',
    },
    {
      name: '出生、寿命、连续线迹与路径记忆',
      status: 'passed',
      evidence: '固定单点版本在 0、12、23、50 秒的总活跃粒子分别为 1、422、783、1055，发散点分别为 0、421、782、1054；50 秒时有 800 条记忆记录、32429 段记忆短线和 8628 段流动短线，出生记录容量为 2499。B 长停实际播放约 1.43 秒，核心位置保持不变，总线段由 12870 增至 15576，流动没有冻结。',
    },
    {
      name: '平滑路线、目标减速与路径安全',
      status: 'passed',
      evidence: '50 秒路线使用三次 Hermite 曲线，A 停 2 秒、B 停 6 秒、返回 B 停 2 秒、D 停 1.5 秒，C 连续绕行。C 到点切线缩放为 28%，速度约 0.254 m/s；D 前长横移分配 4 秒。3000 帧复查中 A—D 最小中心距离分别为 1.10、1.15、1.242802、1.228841 米。',
    },
    {
      name: 'A 点连续转身与集中式低位镜头',
      status: 'passed',
      evidence: 'A 在停留段完成朝向插值，低位视野角 48°，跟随距离随停留和作品距离连续调整，墙面与 1.18 米作品径向安全边界同时约束目标机位和实际机位。60 fps 的 A 段检查每帧最大朝向变化约 2.256°、最大镜头位移约 0.045 米，4.9 → 5.2 秒镜头仅移动约 0.147 米，重复定位误差为 0。最终 1000 帧完整播放没有穿墙或进入展台，最小镜头—作品中心距离约 1.179 米。已查看入口、A、B、C 与俯视，截图保存为 replay-a-smooth-turn.png 与 replay-motion-overhead.png。',
    },
    {
      name: '作品注视目标与平滑视线切换',
      status: 'passed',
      evidence: '路线朝向控制机位，作品位置控制视线；注视顺序为 A → B → C → 返回 B → D → 出口，每次切换用 1.2 秒 smoothstep 插值。已实际查看 4 秒 A、13 秒 B、23 秒 C、44.5 秒 D 和 6 秒 A→B 转场，作品保持主体构图且核心线迹可辨。五次切换各连续检查 90 帧，墙面违规为 0，最小镜头—作品中心距离约 1.324 米；23 → 4 → 23 秒重复定位误差为 0。',
    },
    {
      name: '最终画面复查与线迹深度修复',
      status: 'passed',
      evidence: '已实际查看 12 秒 B 长停俯视、23 秒 C 绕行低位和 50 秒完整路线俯视。连续流线沿三维路线生成，作品周围出现交叉缠绕与复杂线团，核心、展台和 HUD 可读。自定义线条 shader 已加入对数深度处理；辅助线不代替粒子线迹。',
    },
    {
      name: '固定单点核心、发散粒子与连续线迹',
      status: 'passed',
      evidence: '个人阶段已固定为单点核心＋发散粒子＋连续线迹，粒子群、无核心、模式按钮、Digit1/2/3 快捷键和粒子群核心计算均已移除。最终代码在 23 秒实际查看，783 个活跃粒子、782 个发散点、13783 段流动短线与 14285 段记忆短线均与移除前一致；数字键不改变形态，模式切换 QA 接口已不存在，23 → 4 → 23 秒重复定位误差为 0。',
    },
    {
      name: '发散粒子压力色与寿命色相渐变',
      status: 'passed',
      evidence: '发散粒子按出生压力色、当前压力色和存活时间连续改变色相；流动粒子寿命偏移最高 54°，记忆粒子在 36 秒内偏移最高 36°。已实际查看 23 秒低位与 50 秒完整路线俯视，最终截图保存为 single-core-emission-color.png。粒子颜色缓冲区在 23 → 23.7 秒发生变化，返回 23 秒后 72 个颜色通道值全部精确还原，重复定位误差为 0。',
    },
    {
      name: '播放控制与绝对时间重复定位',
      status: 'passed',
      evidence: '实际播放时间正常推进；画布键盘事件验证 Space 暂停／继续、V 切换俯视／低位、R 回到入口并重新开始。12 → 25 → 12 秒重复定位前后截图 SHA-256 均为 cb58b1ee07c7796fe04f0849244f7dd82086c1e8c7f54edaeeecdccc21515b1f。',
    },
    {
      name: 'R1 公共池初始化与材质',
      status: 'passed',
      evidence: '公共池场景在离屏 Edit3D 中初始化成功，pool_cores、pool_emission、pool_flow、pool_memory 均注册。运行时遍历确认四层材质具有非空中文用途名称；切回 replay 后个人核心存在、公共池对象不存在。',
    },
    {
      name: '21 人共同路线、热区与完整路径记忆',
      status: 'passed',
      evidence: '实际查看 23 秒俯视与低位、50 秒完整路线俯视。21 位 R1 观众各有独立核心、时间与身体参数；B 热权重为 1，仍是最高密度区域，降低叠加亮度后作品、核心与线迹可辨。23 秒有 3103 个活跃记录、26559 段流动线与 38052 段记忆线；50 秒有 5289 个活跃记录、27102 段流动线与 92210 段记忆线。截图保存为 pool-r1-23-overhead.png、pool-r1-23-low.png、pool-r1-50-overhead.png。',
    },
    {
      name: '公共池播放控制与逐像素重复定位',
      status: 'passed',
      evidence: '暂停后 step(0.5) 仍停留在 23 秒，继续后推进到 23.5 秒；V 切换视角，R 回到 0 秒并重新播放。23 → 4 → 23 秒的观众数、粒子数与线段数完全一致，两次 23 秒俯视截图 SHA-256 均为 b3a64af267eeeee2c809d1692dcf3703fba0ca2b1dc8358d4f88a45a67ec932d。',
    },
    {
      name: '36 人四路线初始化与真实路径偏差',
      status: 'passed',
      evidence: '公共池最终场景包含 R1／R2／R3／R4 共 21／7／5／3 人。R2 跳过 C，R3 经独立 A → C 平滑连接段先看 C 再看 B，R4 经独立 C → D 段且不返回 B。逐一探测全部观众的作品到达点，四条路线最大误差分别为 0.502011、0.348770、0.368055、0.510850 米，均来自 lane 偏移；每条路线 201 个时间采样均无 NaN，空间坐标有界。',
    },
    {
      name: '36 人画面、曝光修复与完整路径记忆',
      status: 'passed',
      evidence: '实际查看最终 23 秒俯视与低位、50 秒完整路线俯视。初次 36 人全路径画面中 D 与 A 叠加过亮，降低长期线迹 alpha 和记忆粒子亮度后复查，作品轮廓与路径可辨。23 秒 36 人全部在场，有 5363 个活跃记录、46871 段流动线、64896 段记忆线；50 秒有 8823 个活跃记录、43576 段流动线、155714 段记忆线。最终截图为 pool-36-23-overhead.png、pool-36-23-low.png、pool-36-50-overhead.png。',
    },
    {
      name: '36 人播放控制与逐像素重复定位',
      status: 'passed',
      evidence: '暂停后 step(0.5) 仍停留在 23 秒，继续后推进到 23.5 秒；V 与 R 有效。23 → 4 → 23 秒的各路线在场人数、粒子数和线段数完全一致，两次最终 23 秒俯视截图 SHA-256 均为 06ac91cc7a4862f344222782c1ada17709ef07433dca97565f552160cd784a33。切回 replay 后个人核心存在，36 人公共池对象不存在。',
    },
    {
      name: '公共池“我”的第一人称与作品注视',
      status: 'passed',
      evidence: '第一人称以 sampleRoute 的个人核心位置为机位，眼高 1.54 米，不新增第 37 位观众；与个人版共用 replay-focus.js 的 A → B → C → 返回 B → D → 出口注视。初版 48° 下 A、C 过满且周围线迹难读，实际截图后仅将公共池第一视角改为 58°。已复查 4 秒 A、13 秒 B、23 秒 C、34 秒返回 B、44.5 秒 D；数据潮包围感与作品可读性成立，个人版仍保持 48°。',
    },
    {
      name: '第一视角控制、路线安全与重复定位',
      status: 'passed',
      evidence: 'V 三态循环、右上按钮、Space、R、暂停与继续均通过。23 → 4 → 23 秒后镜头、作品目标、36 人分布、5363 个活跃记录和线段统计完全一致；同状态截图像素差最大 6 级，135 个像素有变化，无超过 8 级色差，未声称文件哈希完全一致。1001 个路线采样无 NaN，A—D 最小中心距离为 1.10、1.15、1.242859、1.228886 米。切回 replay 后 23 秒核心位置、783 个活跃粒子、48° 跟随镜头均正常。最终截图为 pool-36-first-13-b.png、pool-36-first-23-c.png、pool-36-first-34-return-b.png、pool-36-first-44-d.png。',
    },
    {
      name: '白色暗场、独立聚光灯与自发光呈现',
      status: 'passed',
      evidence: '展厅、展台、作品、门框与标识全部使用白色系 MeshStandardMaterial，网格无 emissive；场景无全局方向主光，A／B／C／D 各有一盏强度 7、距离 7 米的微弱聚光灯，半球环境光为 0.22。粒子核心、发散点和两类线迹保持身体数据色相与加色／不受光照呈现，公共池 Points 已关闭 tone mapping；没有虚构后期 Bloom。10 个材质均有中文用途名称，作品节点 B 的编辑面板实际显示对应材质卡，sceneLint 返回空数组。',
    },
    {
      name: '白色暗场多视角最终画面',
      status: 'passed',
      evidence: '已实际播放并检查个人 23 秒低位、公共池 23 秒俯视、34 秒返回 B 第一视角及 50 秒完整路径俯视。初版聚光灯强度 10 在俯视偏亮，最终调整为 7 后重新检查；白色体块、局部光区、发光线迹与数据潮均可读，未改变路线、数据、粒子数量或镜头。最终截图为 render-white-replay-23.png、render-white-pool-23-overhead.png、render-white-pool-34-first.png、render-white-pool-50-overhead.png。',
    },
    {
      name: 'English interface and unchanged simulation',
      status: 'passed',
      evidence: 'All four scenes, HUDs, playback controls, route states, scene objects and material names were inspected in English. Personal Replay at 23 seconds retained 783 active particles, 782 emission points, 13,783 flow segments and 14,285 memory segments. Public Pool first-person view at 34 seconds retained 36 visitors, 6,951 active records, 47,141 flow segments and 102,912 memory segments. Artwork Node B displayed the English material cards Artwork Body · White Satin, Spatial Signs · Non-emissive White, Artwork & Exit · Warm White Matte, Simulated Gallery Route · White Guide and Exhibit Plinths · Warm White Stone. Portfolio utility scripts were reorganized and all three passed Python syntax validation.',
    },
    {
      name: '编译与独立构建',
      status: 'passed',
      evidence: '个人固定单点、36 人四路线公共池、第一人称与白色暗场最终代码的 npm run check 和 npm run build 均通过。旧版 day-one-replay.webm 未作为当前版本的视频证据。',
    },
  ],
  limitations: [
    '个人真实输入是日汇总；50 秒内的连续身体参数、空间路线、停留、绕行与返回均为模拟。公共池已可视化全部 36 位模拟观众；逐秒真实身体数据、移除我与正式问卷尚未实现。',
    '公共池已有俯视、入口固定低位与“我”的第一视角；个人—公共池自动对照和移除我仍留到后续阶段。离屏验收不覆盖桌面原生工具栏、宿主快捷键或跨进程焦点行为；本轮未重新导出视频。',
  ],
}
