/** auto-generated — structure specs applied */
export default {
  "schema": "boxcraft.presets.v1",
  "note": "Imported SIZE directory only (shipping boxes). Geometry JSON under geometry/ is reference index, not production dielines. Engine always regenerates via BOXCRAFT templates.",
  "generatedFrom": [
    "docs\\pacdora_shipping_boxes\\shipping_boxes.csv",
    "geometry/pacdora_boxes"
  ],
  "count": 47,
  "mapped": 47,
  "missingGeom": 0,
  "byTemplate": {
    "spec-PairBuckletriple": 1,
    "spec-PairBuckletripleBackward": 1,
    "spec-SplitLockBuckleBottomBox": 1,
    "spec-SplitLockselflockingBox": 1,
    "spec-TearOffCableFlatBox": 1,
    "spec-BottomInsertingBoxWithHalfSelfLockingUpperCover": 1,
    "spec-BuckleBottomBoxWithInsertion": 1,
    "spec-FlapBotselflock": 1,
    "rea-roofflat-handle": 1,
    "spec-RoofflatHandleBuckleBackward": 1,
    "spec-RoofflatHandleBuckletriple": 1,
    "spec-RoofflatHandleBuckletripleBackward": 1,
    "spec-FlatMouthSpecialLockBottom": 1,
    "spec-InterlockPortableTrayCase": 1,
    "spec-FlapBoxWithTopLatchTwo": 1,
    "spec-NonSlotLockBottomFlipBox": 1,
    "spec-ZipperShapedAirplaneCase": 1,
    "spec-FlipSidePlugUnbonded": 1,
    "rea-carton-0201": 3,
    "spec-CartonHandhole": 1,
    "spec-CartonRegular0209": 1,
    "spec-RegularCartonWithHandleHoles": 1,
    "spec-InsideCornerFlatCarton": 1,
    "spec-RegularCardboardBoxABSurface": 1,
    "spec-RegularCartonFourPieces": 1,
    "spec-Carton02": 1,
    "spec-Carton03": 1,
    "spec-CartonFrontZipper": 1,
    "spec-InsideCornerZipperCarton": 1,
    "spec-CartonEconomic": 1,
    "spec-CartonEconomicHandhole": 1,
    "spec-CartonSelfBlock": 1,
    "spec-CartonMovehouseStrengthen": 1,
    "spec-CartonSelfSixBlock": 1,
    "spec-SixCompartmentLinedCarton": 1,
    "spec-SixCompartmentLinedSelflockingBottomFlatCarton": 1,
    "spec-CartonFlatWithFlipLatch": 1,
    "spec-Carton04": 1,
    "spec-BottomCardboardBoxABSurface": 1,
    "spec-BottomLessCoverCardboardBox": 1,
    "spec-CartonHandholeCoverbox": 1,
    "spec-BreatherHoleCoverbox": 1,
    "spec-MediumSealedCardboardBox": 1,
    "spec-TrayTypeCarton": 1,
    "spec-NonStickTrayBottomMatchingBox": 1
  },
  "byCategory": {
    "shipping": 47
  },
  "categories": [
    {
      "id": "shipping",
      "label": "运输箱",
      "count": 47
    }
  ],
  "presets": [
    {
      "id": "import-102040",
      "sourceNum": "102040",
      "label": "插口式产品盒",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 300,
      "width": 150,
      "height": 181.5,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-PairBuckletriple",
      "hasGeometry": true,
      "cutCount": 92,
      "foldCount": 12,
      "sheetW": 952,
      "sheetH": 458.5,
      "geomRel": "geometry/pacdora_boxes/102040.json",
      "subclassIds": [
        "shipping",
        "tuck"
      ],
      "subclassLabels": [
        "运输箱",
        "插口盒"
      ],
      "structureCode": "PairBuckletriple",
      "specFrom": "rea-pair-ste",
      "templateSource": "structure-spec",
      "coverRel": "shipping-covers/102040.png"
    },
    {
      "id": "import-102041",
      "sourceNum": "102041",
      "label": "自动底部三扣底邮寄盒",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 300,
      "width": 150,
      "height": 180,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-PairBuckletripleBackward",
      "hasGeometry": true,
      "cutCount": 76,
      "foldCount": 12,
      "sheetW": 952,
      "sheetH": 465,
      "geomRel": "geometry/pacdora_boxes/102041.json",
      "subclassIds": [
        "shipping",
        "tuck"
      ],
      "subclassLabels": [
        "运输箱",
        "插口盒"
      ],
      "structureCode": "PairBuckletripleBackward",
      "specFrom": "rea-pair-ste",
      "templateSource": "structure-spec",
      "coverRel": "shipping-covers/102041.png"
    },
    {
      "id": "import-103020",
      "sourceNum": "103020",
      "label": "双开运输盒",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 200,
      "width": 120,
      "height": 180,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-SplitLockBuckleBottomBox",
      "hasGeometry": true,
      "cutCount": 81,
      "foldCount": 16,
      "sheetW": 672,
      "sheetH": 346,
      "geomRel": "geometry/pacdora_boxes/103020.json",
      "subclassIds": [
        "shipping",
        "tuck"
      ],
      "subclassLabels": [
        "运输箱",
        "插口盒"
      ],
      "structureCode": "SplitLockBuckleBottomBox",
      "specFrom": "auto-lock-bottom",
      "templateSource": "structure-spec",
      "coverRel": "shipping-covers/103020.png"
    },
    {
      "id": "import-103021",
      "sourceNum": "103021",
      "label": "双开运输盒",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 200,
      "width": 120,
      "height": 180,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-SplitLockselflockingBox",
      "hasGeometry": true,
      "cutCount": 95,
      "foldCount": 18,
      "sheetW": 672,
      "sheetH": 355,
      "geomRel": "geometry/pacdora_boxes/103021.json",
      "subclassIds": [
        "shipping",
        "tuck"
      ],
      "subclassLabels": [
        "运输箱",
        "插口盒"
      ],
      "structureCode": "SplitLockselflockingBox",
      "specFrom": "auto-lock-bottom",
      "templateSource": "structure-spec",
      "coverRel": "shipping-covers/103021.png"
    },
    {
      "id": "import-110171",
      "sourceNum": "110171",
      "label": "带撕线的运输盒",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 150,
      "width": 291,
      "height": 193,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-TearOffCableFlatBox",
      "hasGeometry": true,
      "cutCount": 239,
      "foldCount": 13,
      "sheetW": 935,
      "sheetH": 506,
      "geomRel": "geometry/pacdora_boxes/110171.json",
      "subclassIds": [
        "shipping"
      ],
      "subclassLabels": [
        "运输箱"
      ],
      "structureCode": "TearOffCableFlatBox",
      "specFrom": null,
      "templateSource": "structure-spec",
      "coverRel": "shipping-covers/110171.png"
    },
    {
      "id": "import-110680",
      "sourceNum": "110680",
      "label": "方形运输箱",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 150,
      "width": 100,
      "height": 100,
      "thickness": 0.5,
      "materialId": "white",
      "templateId": "spec-BottomInsertingBoxWithHalfSelfLockingUpperCover",
      "hasGeometry": true,
      "cutCount": 77,
      "foldCount": 12,
      "sheetW": 520.9,
      "sheetH": 321.04999999999995,
      "geomRel": "geometry/pacdora_boxes/110680.json",
      "subclassIds": [
        "square",
        "mailer",
        "shipping"
      ],
      "subclassLabels": [
        "方形盒",
        "邮寄盒",
        "运输箱"
      ],
      "structureCode": "BottomInsertingBoxWithHalfSelfLockingUpperCover",
      "specFrom": "fefco-0201",
      "templateSource": "structure-spec",
      "coverRel": "shipping-covers/110680.png"
    },
    {
      "id": "import-110810",
      "sourceNum": "110810",
      "label": "插舌式运输盒",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 300,
      "width": 100,
      "height": 150,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-BuckleBottomBoxWithInsertion",
      "hasGeometry": true,
      "cutCount": 67,
      "foldCount": 20,
      "sheetW": 879.5,
      "sheetH": 291,
      "geomRel": "geometry/pacdora_boxes/110810.json",
      "subclassIds": [
        "shipping"
      ],
      "subclassLabels": [
        "运输箱"
      ],
      "structureCode": "BuckleBottomBoxWithInsertion",
      "specFrom": null,
      "templateSource": "structure-spec",
      "coverRel": "shipping-covers/110810.png"
    },
    {
      "id": "import-112010",
      "sourceNum": "112010",
      "label": "平邮箱",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 120,
      "width": 60,
      "height": 160.5,
      "thickness": 0.5,
      "materialId": "white",
      "templateId": "spec-FlapBotselflock",
      "hasGeometry": true,
      "cutCount": 78,
      "foldCount": 14,
      "sheetW": 377.9,
      "sheetH": 240.2,
      "geomRel": "geometry/pacdora_boxes/112010.json",
      "subclassIds": [
        "shipping"
      ],
      "subclassLabels": [
        "运输箱"
      ],
      "structureCode": "FlapBotselflock",
      "specFrom": "auto-lock-bottom",
      "templateSource": "structure-spec",
      "coverRel": "shipping-covers/112010.png"
    },
    {
      "id": "import-112470",
      "sourceNum": "112470",
      "label": "扣锁礼品运输盒",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 300,
      "width": 120,
      "height": 202.5,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "rea-roofflat-handle",
      "hasGeometry": true,
      "cutCount": 93,
      "foldCount": 14,
      "sheetW": 892,
      "sheetH": 380.5,
      "geomRel": "geometry/pacdora_boxes/112470.json",
      "subclassIds": [
        "shipping",
        "handle",
        "tuck"
      ],
      "subclassLabels": [
        "运输箱",
        "带手柄的盒子",
        "插口盒"
      ],
      "structureCode": "RoofflatHandleBuckle",
      "templateSource": "structure-code",
      "coverRel": "shipping-covers/112470.png"
    },
    {
      "id": "import-112471",
      "sourceNum": "112471",
      "label": "扣锁运输盒",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 300,
      "width": 120,
      "height": 202.5,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-RoofflatHandleBuckleBackward",
      "hasGeometry": true,
      "cutCount": 93,
      "foldCount": 14,
      "sheetW": 892,
      "sheetH": 380.5,
      "geomRel": "geometry/pacdora_boxes/112471.json",
      "subclassIds": [
        "shipping",
        "handle",
        "tuck"
      ],
      "subclassLabels": [
        "运输箱",
        "带手柄的盒子",
        "插口盒"
      ],
      "structureCode": "RoofflatHandleBuckleBackward",
      "specFrom": null,
      "templateSource": "structure-spec",
      "coverRel": "shipping-covers/112471.png"
    },
    {
      "id": "import-112480",
      "sourceNum": "112480",
      "label": "三锁运输盒",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 300,
      "width": 120,
      "height": 200,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-RoofflatHandleBuckletriple",
      "hasGeometry": true,
      "cutCount": 106,
      "foldCount": 14,
      "sheetW": 892,
      "sheetH": 380.5,
      "geomRel": "geometry/pacdora_boxes/112480.json",
      "subclassIds": [
        "shipping",
        "handle",
        "tuck"
      ],
      "subclassLabels": [
        "运输箱",
        "带手柄的盒子",
        "插口盒"
      ],
      "structureCode": "RoofflatHandleBuckletriple",
      "specFrom": "auto-lock-bottom",
      "templateSource": "structure-spec",
      "coverRel": "shipping-covers/112480.png"
    },
    {
      "id": "import-112481",
      "sourceNum": "112481",
      "label": "反锁运输盒",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 300,
      "width": 120,
      "height": 200,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-RoofflatHandleBuckletripleBackward",
      "hasGeometry": true,
      "cutCount": 107,
      "foldCount": 14,
      "sheetW": 892,
      "sheetH": 380.5,
      "geomRel": "geometry/pacdora_boxes/112481.json",
      "subclassIds": [
        "shipping",
        "handle",
        "tuck"
      ],
      "subclassLabels": [
        "运输箱",
        "带手柄的盒子",
        "插口盒"
      ],
      "structureCode": "RoofflatHandleBuckletripleBackward",
      "specFrom": null,
      "templateSource": "structure-spec",
      "coverRel": "shipping-covers/112481.png"
    },
    {
      "id": "import-112511",
      "sourceNum": "112511",
      "label": "插口运输盒",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 300,
      "width": 100,
      "height": 300,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-FlatMouthSpecialLockBottom",
      "hasGeometry": true,
      "cutCount": 58,
      "foldCount": 16,
      "sheetW": 860,
      "sheetH": 468,
      "geomRel": "geometry/pacdora_boxes/112511.json",
      "subclassIds": [
        "shipping",
        "folding"
      ],
      "subclassLabels": [
        "运输箱",
        "折叠盒"
      ],
      "structureCode": "FlatMouthSpecialLockBottom",
      "specFrom": "tuck-end-straight",
      "templateSource": "structure-spec",
      "coverRel": "shipping-covers/112511.png"
    },
    {
      "id": "import-116200",
      "sourceNum": "116200",
      "label": "带手柄的盒",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 300,
      "width": 200,
      "height": 150,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-InterlockPortableTrayCase",
      "hasGeometry": true,
      "cutCount": 78,
      "foldCount": 17,
      "sheetW": 980,
      "sheetH": 940.5,
      "geomRel": "geometry/pacdora_boxes/116200.json",
      "subclassIds": [
        "shipping",
        "handle"
      ],
      "subclassLabels": [
        "运输箱",
        "带手柄的盒子"
      ],
      "structureCode": "InterlockPortableTrayCase",
      "specFrom": null,
      "templateSource": "structure-spec",
      "coverRel": "shipping-covers/116200.png"
    },
    {
      "id": "import-152102",
      "sourceNum": "152102",
      "label": "定制自锁式邮寄盒",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 295,
      "width": 193.5,
      "height": 99,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-FlapBoxWithTopLatchTwo",
      "hasGeometry": true,
      "cutCount": 74,
      "foldCount": 18,
      "sheetW": 500,
      "sheetH": 737.75,
      "geomRel": "geometry/pacdora_boxes/152102.json",
      "subclassIds": [
        "shipping"
      ],
      "subclassLabels": [
        "运输箱"
      ],
      "structureCode": "FlapBoxWithTopLatchTwo",
      "specFrom": "auto-lock-bottom",
      "templateSource": "structure-spec",
      "coverRel": "shipping-covers/152102.png"
    },
    {
      "id": "import-153031",
      "sourceNum": "153031",
      "label": "翻盖邮寄盒",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 294,
      "width": 200,
      "height": 60,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-NonSlotLockBottomFlipBox",
      "hasGeometry": true,
      "cutCount": 66,
      "foldCount": 18,
      "sheetW": 561,
      "sheetH": 528,
      "geomRel": "geometry/pacdora_boxes/153031.json",
      "subclassIds": [
        "mailer",
        "shipping",
        "folding",
        "tuck"
      ],
      "subclassLabels": [
        "邮寄盒",
        "运输箱",
        "折叠盒",
        "插口盒"
      ],
      "structureCode": "NonSlotLockBottomFlipBox",
      "specFrom": "fefco-0427",
      "templateSource": "structure-spec",
      "coverRel": "shipping-covers/153031.png"
    },
    {
      "id": "import-156090",
      "sourceNum": "156090",
      "label": "打开的纸箱",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 150,
      "width": 100,
      "height": 80,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-ZipperShapedAirplaneCase",
      "hasGeometry": true,
      "cutCount": 145,
      "foldCount": 27,
      "sheetW": 365,
      "sheetH": 455,
      "geomRel": "geometry/pacdora_boxes/156090.json",
      "subclassIds": [
        "shipping",
        "folding"
      ],
      "subclassLabels": [
        "运输箱",
        "折叠盒"
      ],
      "structureCode": "ZipperShapedAirplaneCase",
      "specFrom": null,
      "templateSource": "structure-spec",
      "coverRel": "shipping-covers/156090.png"
    },
    {
      "id": "import-156131",
      "sourceNum": "156131",
      "label": "带非粘合侧榫锁的运输盒",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 300,
      "width": 200,
      "height": 100,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-FlipSidePlugUnbonded",
      "hasGeometry": true,
      "cutCount": 127,
      "foldCount": 30,
      "sheetW": 625.5,
      "sheetH": 735,
      "geomRel": "geometry/pacdora_boxes/156131.json",
      "subclassIds": [
        "shipping"
      ],
      "subclassLabels": [
        "运输箱"
      ],
      "structureCode": "FlipSidePlugUnbonded",
      "specFrom": null,
      "templateSource": "structure-spec",
      "coverRel": "shipping-covers/156131.png"
    },
    {
      "id": "import-200010",
      "sourceNum": "200010",
      "label": "0201运输纸箱",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 430,
      "width": 210,
      "height": 270,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "rea-carton-0201",
      "hasGeometry": true,
      "cutCount": 54,
      "foldCount": 12,
      "sheetW": 1340,
      "sheetH": 494,
      "geomRel": "geometry/pacdora_boxes/200010.json",
      "subclassIds": [
        "shipping",
        "tuck"
      ],
      "subclassLabels": [
        "运输箱",
        "插口盒"
      ],
      "structureCode": "Carton",
      "templateSource": "structure-code",
      "coverRel": "shipping-covers/200010.png"
    },
    {
      "id": "import-200012",
      "sourceNum": "200012",
      "label": "带便携搬运孔的运输纸箱",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 430,
      "width": 210,
      "height": 270,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-CartonHandhole",
      "hasGeometry": true,
      "cutCount": 67,
      "foldCount": 12,
      "sheetW": 1340,
      "sheetH": 494,
      "geomRel": "geometry/pacdora_boxes/200012.json",
      "subclassIds": [
        "shipping",
        "handle"
      ],
      "subclassLabels": [
        "运输箱",
        "带手柄的盒子"
      ],
      "structureCode": "CartonHandhole",
      "specFrom": "rea-carton-0201",
      "templateSource": "structure-spec",
      "coverRel": "shipping-covers/200012.png"
    },
    {
      "id": "import-200013",
      "sourceNum": "200013",
      "label": "0209常规纸质运输纸箱",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 430,
      "width": 210,
      "height": 270,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-CartonRegular0209",
      "hasGeometry": true,
      "cutCount": 62,
      "foldCount": 12,
      "sheetW": 1340,
      "sheetH": 440,
      "geomRel": "geometry/pacdora_boxes/200013.json",
      "subclassIds": [
        "shipping"
      ],
      "subclassLabels": [
        "运输箱"
      ],
      "structureCode": "CartonRegular0209",
      "specFrom": "rea-carton-0201",
      "templateSource": "structure-spec",
      "coverRel": "shipping-covers/200013.png"
    },
    {
      "id": "import-200014",
      "sourceNum": "200014",
      "label": "新鲜水果运输纸箱",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 426,
      "width": 210,
      "height": 270,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-RegularCartonWithHandleHoles",
      "hasGeometry": true,
      "cutCount": 78,
      "foldCount": 14,
      "sheetW": 1332,
      "sheetH": 440,
      "geomRel": "geometry/pacdora_boxes/200014.json",
      "subclassIds": [
        "shipping"
      ],
      "subclassLabels": [
        "运输箱"
      ],
      "structureCode": "RegularCartonWithHandleHoles",
      "specFrom": null,
      "templateSource": "structure-spec",
      "coverRel": "shipping-covers/200014.png"
    },
    {
      "id": "import-200015",
      "sourceNum": "200015",
      "label": "缓冲的运输箱",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 429,
      "width": 209,
      "height": 269,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-InsideCornerFlatCarton",
      "hasGeometry": true,
      "cutCount": 32,
      "foldCount": 32,
      "sheetW": 1336,
      "sheetH": 488,
      "geomRel": "geometry/pacdora_boxes/200015.json",
      "subclassIds": [
        "shipping"
      ],
      "subclassLabels": [
        "运输箱"
      ],
      "structureCode": "InsideCornerFlatCarton",
      "specFrom": "fefco-0201",
      "templateSource": "structure-spec",
      "coverRel": "shipping-covers/200015.png"
    },
    {
      "id": "import-200016",
      "sourceNum": "200016",
      "label": "纸箱运输盒",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 430,
      "width": 210,
      "height": 270,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-RegularCardboardBoxABSurface",
      "hasGeometry": true,
      "cutCount": 60,
      "foldCount": 13,
      "sheetW": 693,
      "sheetH": 1028,
      "geomRel": "geometry/pacdora_boxes/200016.json",
      "subclassIds": [
        "shipping",
        "tuck"
      ],
      "subclassLabels": [
        "运输箱",
        "插口盒"
      ],
      "structureCode": "RegularCardboardBoxABSurface",
      "specFrom": null,
      "templateSource": "structure-spec",
      "coverRel": "shipping-covers/200016.png"
    },
    {
      "id": "import-200017",
      "sourceNum": "200017",
      "label": "纸箱运输盒",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 430,
      "width": 210,
      "height": 270,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-RegularCartonFourPieces",
      "hasGeometry": true,
      "cutCount": 72,
      "foldCount": 15,
      "sheetW": 778,
      "sheetH": 1028,
      "geomRel": "geometry/pacdora_boxes/200017.json",
      "subclassIds": [
        "shipping",
        "tuck"
      ],
      "subclassLabels": [
        "运输箱",
        "插口盒"
      ],
      "structureCode": "RegularCartonFourPieces",
      "specFrom": null,
      "templateSource": "structure-spec",
      "coverRel": "shipping-covers/200017.png"
    },
    {
      "id": "import-200020",
      "sourceNum": "200020",
      "label": "纸箱 0202 国际标准",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 430,
      "width": 210,
      "height": 270,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-Carton02",
      "hasGeometry": true,
      "cutCount": 62,
      "foldCount": 12,
      "sheetW": 1340,
      "sheetH": 532,
      "geomRel": "geometry/pacdora_boxes/200020.json",
      "subclassIds": [
        "shipping"
      ],
      "subclassLabels": [
        "运输箱"
      ],
      "structureCode": "Carton02",
      "specFrom": "rea-carton-0201",
      "templateSource": "structure-spec",
      "coverRel": "shipping-covers/200020.png"
    },
    {
      "id": "import-200030",
      "sourceNum": "200030",
      "label": "0203 国际标准运输纸箱",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 430,
      "width": 210,
      "height": 270,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-Carton03",
      "hasGeometry": true,
      "cutCount": 62,
      "foldCount": 12,
      "sheetW": 1340,
      "sheetH": 710,
      "geomRel": "geometry/pacdora_boxes/200030.json",
      "subclassIds": [
        "shipping"
      ],
      "subclassLabels": [
        "运输箱"
      ],
      "structureCode": "Carton03",
      "templateSource": "structure-spec",
      "specFrom": "rea-carton-0201",
      "coverRel": "shipping-covers/200030.png"
    },
    {
      "id": "import-200034",
      "sourceNum": "200034",
      "label": "带拉链的纸质运输盒",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 429,
      "width": 209,
      "height": 259,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-CartonFrontZipper",
      "hasGeometry": true,
      "cutCount": 279,
      "foldCount": 41,
      "sheetW": 1336,
      "sheetH": 821,
      "geomRel": "geometry/pacdora_boxes/200034.json",
      "subclassIds": [
        "shipping"
      ],
      "subclassLabels": [
        "运输箱"
      ],
      "structureCode": "CartonFrontZipper",
      "specFrom": "rea-carton-0201",
      "templateSource": "structure-spec",
      "coverRel": "shipping-covers/200034.png"
    },
    {
      "id": "import-200035",
      "sourceNum": "200035",
      "label": "带拉链的运输纸盒",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 429,
      "width": 209,
      "height": 269,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-InsideCornerZipperCarton",
      "hasGeometry": true,
      "cutCount": 254,
      "foldCount": 63,
      "sheetW": 1336,
      "sheetH": 699,
      "geomRel": "geometry/pacdora_boxes/200035.json",
      "subclassIds": [
        "shipping"
      ],
      "subclassLabels": [
        "运输箱"
      ],
      "structureCode": "InsideCornerZipperCarton",
      "specFrom": "fefco-0201",
      "templateSource": "structure-spec",
      "coverRel": "shipping-covers/200035.png"
    },
    {
      "id": "import-200100",
      "sourceNum": "200100",
      "label": "平顶运输纸箱",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 430,
      "width": 210,
      "height": 270,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-CartonEconomic",
      "hasGeometry": true,
      "cutCount": 79,
      "foldCount": 12,
      "sheetW": 1340,
      "sheetH": 494,
      "geomRel": "geometry/pacdora_boxes/200100.json",
      "subclassIds": [
        "shipping"
      ],
      "subclassLabels": [
        "运输箱"
      ],
      "structureCode": "CartonEconomic",
      "specFrom": "rea-carton-0201",
      "templateSource": "structure-spec",
      "coverRel": "shipping-covers/200100.png"
    },
    {
      "id": "import-200102",
      "sourceNum": "200102",
      "label": "带便携孔的运输纸箱ab面",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 430,
      "width": 210,
      "height": 270,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-CartonEconomicHandhole",
      "hasGeometry": true,
      "cutCount": 83,
      "foldCount": 12,
      "sheetW": 1340,
      "sheetH": 494,
      "geomRel": "geometry/pacdora_boxes/200102.json",
      "subclassIds": [
        "shipping",
        "handle"
      ],
      "subclassLabels": [
        "运输箱",
        "带手柄的盒子"
      ],
      "structureCode": "CartonEconomicHandhole",
      "specFrom": "rea-carton-0201",
      "templateSource": "structure-spec",
      "coverRel": "shipping-covers/200102.png"
    },
    {
      "id": "import-200200",
      "sourceNum": "200200",
      "label": "折叠运输箱",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 350,
      "width": 350,
      "height": 200,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-CartonSelfBlock",
      "hasGeometry": true,
      "cutCount": 92,
      "foldCount": 18,
      "sheetW": 1460,
      "sheetH": 770,
      "geomRel": "geometry/pacdora_boxes/200200.json",
      "subclassIds": [
        "shipping",
        "tuck"
      ],
      "subclassLabels": [
        "运输箱",
        "插口盒"
      ],
      "structureCode": "CartonSelfBlock",
      "specFrom": "rea-carton-0201",
      "templateSource": "structure-spec",
      "coverRel": "shipping-covers/200200.png"
    },
    {
      "id": "import-200210",
      "sourceNum": "200210",
      "label": "纸箱移动纸",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 500,
      "width": 400,
      "height": 400,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-CartonMovehouseStrengthen",
      "hasGeometry": true,
      "cutCount": 96,
      "foldCount": 20,
      "sheetW": 1867,
      "sheetH": 1035,
      "geomRel": "geometry/pacdora_boxes/200210.json",
      "subclassIds": [
        "shipping",
        "tuck"
      ],
      "subclassLabels": [
        "运输箱",
        "插口盒"
      ],
      "structureCode": "CartonMovehouseStrengthen",
      "specFrom": "rea-carton-0201",
      "templateSource": "structure-spec",
      "coverRel": "shipping-covers/200210.png"
    },
    {
      "id": "import-200230",
      "sourceNum": "200230",
      "label": "纸箱六格运输盒",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 350,
      "width": 200,
      "height": 196,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-CartonSelfSixBlock",
      "hasGeometry": true,
      "cutCount": 56,
      "foldCount": 20,
      "sheetW": 1160,
      "sheetH": 622,
      "geomRel": "geometry/pacdora_boxes/200230.json",
      "subclassIds": [
        "shipping",
        "tuck"
      ],
      "subclassLabels": [
        "运输箱",
        "插口盒"
      ],
      "structureCode": "CartonSelfSixBlock",
      "specFrom": "rea-carton-0201",
      "templateSource": "structure-spec",
      "coverRel": "shipping-covers/200230.png"
    },
    {
      "id": "import-200240",
      "sourceNum": "200240",
      "label": "带有 6 格插入物的运输纸箱",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 198,
      "width": 134,
      "height": 238,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-SixCompartmentLinedCarton",
      "hasGeometry": true,
      "cutCount": 98,
      "foldCount": 20,
      "sheetW": 752.5,
      "sheetH": 554,
      "geomRel": "geometry/pacdora_boxes/200240.json",
      "subclassIds": [
        "shipping",
        "tuck"
      ],
      "subclassLabels": [
        "运输箱",
        "插口盒"
      ],
      "structureCode": "SixCompartmentLinedCarton",
      "specFrom": null,
      "templateSource": "structure-spec",
      "coverRel": "shipping-covers/200240.png"
    },
    {
      "id": "import-200250",
      "sourceNum": "200250",
      "label": "带6格的折叠运输盒",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 300,
      "width": 199,
      "height": 100,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-SixCompartmentLinedSelflockingBottomFlatCarton",
      "hasGeometry": true,
      "cutCount": 78,
      "foldCount": 20,
      "sheetW": 1050,
      "sheetH": 409,
      "geomRel": "geometry/pacdora_boxes/200250.json",
      "subclassIds": [
        "shipping",
        "tuck"
      ],
      "subclassLabels": [
        "运输箱",
        "插口盒"
      ],
      "structureCode": "SixCompartmentLinedSelflockingBottomFlatCarton",
      "specFrom": null,
      "templateSource": "structure-spec",
      "coverRel": "shipping-covers/200250.png"
    },
    {
      "id": "import-200280",
      "sourceNum": "200280",
      "label": "带锁扣插入的运输纸箱",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 200,
      "width": 100,
      "height": 80,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-CartonFlatWithFlipLatch",
      "hasGeometry": true,
      "cutCount": 80,
      "foldCount": 14,
      "sheetW": 632,
      "sheetH": 211,
      "geomRel": "geometry/pacdora_boxes/200280.json",
      "subclassIds": [
        "shipping",
        "tuck"
      ],
      "subclassLabels": [
        "运输箱",
        "插口盒"
      ],
      "structureCode": "CartonFlatWithFlipLatch",
      "specFrom": "rea-carton-0201",
      "templateSource": "structure-spec",
      "coverRel": "shipping-covers/200280.png"
    },
    {
      "id": "import-201012",
      "sourceNum": "201012",
      "label": "平口运输盒",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 426,
      "width": 206,
      "height": 266.5,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-Carton04",
      "hasGeometry": true,
      "cutCount": 34,
      "foldCount": 8,
      "sheetW": 1324,
      "sheetH": 376.5,
      "geomRel": "geometry/pacdora_boxes/201012.json",
      "subclassIds": [
        "shipping"
      ],
      "subclassLabels": [
        "运输箱"
      ],
      "structureCode": "Carton04",
      "specFrom": "rea-carton-0201",
      "templateSource": "structure-spec",
      "coverRel": "shipping-covers/201012.png"
    },
    {
      "id": "import-201013",
      "sourceNum": "201013",
      "label": "无底纸箱运输盒",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 426,
      "width": 206,
      "height": 266,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-BottomCardboardBoxABSurface",
      "hasGeometry": true,
      "cutCount": 40,
      "foldCount": 9,
      "sheetW": 685,
      "sheetH": 782,
      "geomRel": "geometry/pacdora_boxes/201013.json",
      "subclassIds": [
        "shipping",
        "tuck"
      ],
      "subclassLabels": [
        "运输箱",
        "插口盒"
      ],
      "structureCode": "BottomCardboardBoxABSurface",
      "specFrom": null,
      "templateSource": "structure-spec",
      "coverRel": "shipping-covers/201013.png"
    },
    {
      "id": "import-201015",
      "sourceNum": "201015",
      "label": "无底纸箱",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 429,
      "width": 209,
      "height": 269,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-BottomLessCoverCardboardBox",
      "hasGeometry": true,
      "cutCount": 30,
      "foldCount": 8,
      "sheetW": 1336,
      "sheetH": 489.5,
      "geomRel": "geometry/pacdora_boxes/201015.json",
      "subclassIds": [
        "shipping",
        "tuck"
      ],
      "subclassLabels": [
        "运输箱",
        "插口盒"
      ],
      "structureCode": "BottomLessCoverCardboardBox",
      "specFrom": null,
      "templateSource": "structure-spec",
      "coverRel": "shipping-covers/201015.png"
    },
    {
      "id": "import-201080",
      "sourceNum": "201080",
      "label": "带手柄的运输箱",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 430,
      "width": 210,
      "height": 270,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-CartonHandholeCoverbox",
      "hasGeometry": true,
      "cutCount": 54,
      "foldCount": 16,
      "sheetW": 1378,
      "sheetH": 782.5,
      "geomRel": "geometry/pacdora_boxes/201080.json",
      "subclassIds": [
        "shipping",
        "handle",
        "lid"
      ],
      "subclassLabels": [
        "运输箱",
        "带手柄的盒子",
        "带盖盒"
      ],
      "structureCode": "CartonHandholeCoverbox",
      "specFrom": "rea-cover-basset",
      "templateSource": "structure-spec",
      "coverRel": "shipping-covers/201080.png"
    },
    {
      "id": "import-201081",
      "sourceNum": "201081",
      "label": "带通气孔的运输纸箱",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 430,
      "width": 210,
      "height": 270,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-BreatherHoleCoverbox",
      "hasGeometry": true,
      "cutCount": 126,
      "foldCount": 24,
      "sheetW": 1378,
      "sheetH": 782.5,
      "geomRel": "geometry/pacdora_boxes/201081.json",
      "subclassIds": [
        "shipping",
        "lid"
      ],
      "subclassLabels": [
        "运输箱",
        "带盖盒"
      ],
      "structureCode": "BreatherHoleCoverbox",
      "specFrom": "rea-cover-basset",
      "templateSource": "structure-spec",
      "coverRel": "shipping-covers/201081.png"
    },
    {
      "id": "import-205010",
      "sourceNum": "205010",
      "label": "纸板运输箱",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 349,
      "width": 199,
      "height": 49,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-MediumSealedCardboardBox",
      "hasGeometry": true,
      "cutCount": 74,
      "foldCount": 14,
      "sheetW": 457,
      "sheetH": 512,
      "geomRel": "geometry/pacdora_boxes/205010.json",
      "subclassIds": [
        "mailer",
        "shipping"
      ],
      "subclassLabels": [
        "邮寄盒",
        "运输箱"
      ],
      "structureCode": "MediumSealedCardboardBox",
      "specFrom": "fefco-0201",
      "templateSource": "structure-spec",
      "coverRel": "shipping-covers/205010.png"
    },
    {
      "id": "import-205011",
      "sourceNum": "205011",
      "label": "纸板运输箱",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 349,
      "width": 199,
      "height": 49,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-TrayTypeCarton",
      "hasGeometry": true,
      "cutCount": 42,
      "foldCount": 12,
      "sheetW": 543,
      "sheetH": 522,
      "geomRel": "geometry/pacdora_boxes/205011.json",
      "subclassIds": [
        "mailer",
        "shipping"
      ],
      "subclassLabels": [
        "邮寄盒",
        "运输箱"
      ],
      "structureCode": "TrayTypeCarton",
      "specFrom": "fefco-0201",
      "templateSource": "structure-spec",
      "coverRel": "shipping-covers/205011.png"
    },
    {
      "id": "import-206080",
      "sourceNum": "206080",
      "label": "折叠配送箱",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 150,
      "width": 120,
      "height": 100,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "spec-NonStickTrayBottomMatchingBox",
      "hasGeometry": true,
      "cutCount": 74,
      "foldCount": 18,
      "sheetW": 401,
      "sheetH": 495.75,
      "geomRel": "geometry/pacdora_boxes/206080.json",
      "subclassIds": [
        "shipping"
      ],
      "subclassLabels": [
        "运输箱"
      ],
      "structureCode": "NonStickTrayBottomMatchingBox",
      "specFrom": null,
      "templateSource": "structure-spec",
      "coverRel": "shipping-covers/206080.png"
    },
    {
      "id": "import-20001001",
      "sourceNum": "20001001",
      "label": "方形运输箱",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 301,
      "width": 301,
      "height": 297,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "rea-carton-0201",
      "hasGeometry": true,
      "cutCount": 54,
      "foldCount": 12,
      "sheetW": 1264,
      "sheetH": 612,
      "geomRel": "geometry/pacdora_boxes/20001001.json",
      "subclassIds": [
        "square",
        "mailer",
        "shipping"
      ],
      "subclassLabels": [
        "方形盒",
        "邮寄盒",
        "运输箱"
      ],
      "structureCode": "Carton",
      "templateSource": "structure-code",
      "coverRel": "shipping-covers/20001001.png"
    },
    {
      "id": "import-20001002",
      "sourceNum": "20001002",
      "label": "药盒",
      "categoryId": "shipping",
      "categoryLabel": "运输箱",
      "length": 430,
      "width": 210,
      "height": 270,
      "thickness": 1.5,
      "materialId": "white",
      "templateId": "rea-carton-0201",
      "hasGeometry": true,
      "cutCount": 54,
      "foldCount": 12,
      "sheetW": 1340,
      "sheetH": 494,
      "geomRel": "geometry/pacdora_boxes/20001002.json",
      "subclassIds": [
        "shipping",
        "tuck"
      ],
      "subclassLabels": [
        "运输箱",
        "插口盒"
      ],
      "structureCode": "Carton",
      "templateSource": "structure-code",
      "coverRel": "shipping-covers/20001002.png"
    }
  ],
  "officialSubclasses": [
    {
      "id": "shipping",
      "label": "运输箱",
      "nameKey": "mailing-shipping-boxes",
      "count": 47
    },
    {
      "id": "mailer",
      "label": "邮寄盒",
      "nameKey": "mailer-box",
      "count": 5
    },
    {
      "id": "tuck",
      "label": "插口盒",
      "nameKey": "tuck-end-boxes",
      "count": 21
    },
    {
      "id": "folding",
      "label": "折叠盒",
      "nameKey": "folding-boxes",
      "count": 3
    },
    {
      "id": "handle",
      "label": "带手柄的盒子",
      "nameKey": "boxes-with-handle",
      "count": 8
    },
    {
      "id": "lid",
      "label": "带盖盒",
      "nameKey": "boxes-with-lid",
      "count": 2
    },
    {
      "id": "square",
      "label": "方形盒",
      "nameKey": "square-boxes",
      "count": 2
    }
  ],
  "subclassNote": "Shipping-only official subclasses; a preset may belong to multiple."
}
