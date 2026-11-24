// Coordinate data transcribed from the supplied MY FIT handoff. No reference images are shipped.
export const INTERIOR = {
  "width": 12,
  "depth": 19,
  "height": 3.8
};
export const DESIGN_ZONES = [
  {
    "id": "showroom",
    "bounds": [
      -6,
      0,
      6,
      13
    ]
  },
  {
    "id": "fitting",
    "bounds": [
      -6,
      13,
      -2,
      19
    ],
    "anchor": [
      -4,
      13,
      0
    ]
  },
  {
    "id": "consult",
    "bounds": [
      -2,
      13,
      2,
      19
    ],
    "anchor": [
      0,
      13,
      0
    ]
  },
  {
    "id": "ootd",
    "bounds": [
      2,
      13,
      6,
      19
    ],
    "anchor": [
      4,
      13,
      0
    ]
  },
  {
    "id": "fragrance",
    "bounds": [
      3.5,
      8,
      6,
      12
    ]
  }
];
export const DESIGN_OBJECTS = [
  {
    "id": "oval_island",
    "center": [
      0,
      6.4
    ],
    "size": [
      2.5,
      4.5,
      0.871
    ]
  },
  {
    "id": "limestone_plinth",
    "center": [
      0,
      10.75
    ],
    "size": [
      1.6,
      0.84,
      0.65
    ]
  },
  {
    "id": "fragrance_counter",
    "center": [
      4.63,
      10.16
    ],
    "size": [
      1.5,
      3.36,
      0.99
    ]
  },
  {
    "id": "fitting_mirror",
    "center": [
      -4,
      18.81
    ]
  },
  {
    "id": "fitting_bench",
    "center": [
      -5.52,
      16.64
    ]
  },
  {
    "id": "fitting_rail",
    "center": [
      -2.53,
      17.06
    ]
  },
  {
    "id": "consult_table",
    "center": [
      0,
      16.04
    ]
  },
  {
    "id": "ootd_pose_mark",
    "center": [
      4,
      17.61
    ]
  }
];
export const CAMERAS = {
  "01_exterior_day": {
    "position": [
      0,
      -12.4,
      1.62
    ],
    "target": [
      0,
      0,
      1.62
    ],
    "focalLengthMm": 34,
    "sensorWidthMm": 36,
    "projection": "perspective",
    "sceneVariant": "day",
    "orthoScale": null,
    "shiftY": 0.105
  },
  "01_exterior_night": {
    "position": [
      0,
      -12.4,
      1.62
    ],
    "target": [
      0,
      0,
      1.62
    ],
    "focalLengthMm": 34,
    "sensorWidthMm": 36,
    "projection": "perspective",
    "sceneVariant": "night",
    "orthoScale": null,
    "shiftY": 0.105
  },
  "02_entry_01": {
    "position": [
      0,
      -9.6,
      1.61
    ],
    "target": [
      0,
      0,
      1.61
    ],
    "focalLengthMm": 30,
    "sensorWidthMm": 36,
    "projection": "perspective",
    "sceneVariant": "day",
    "orthoScale": null,
    "shiftY": 0.065
  },
  "02_entry_02": {
    "position": [
      0,
      -2.3,
      1.61
    ],
    "target": [
      0,
      9,
      1.61
    ],
    "focalLengthMm": 22,
    "sensorWidthMm": 36,
    "projection": "perspective",
    "sceneVariant": "open",
    "orthoScale": null,
    "shiftY": 0
  },
  "02_entry_03": {
    "position": [
      0,
      0.86,
      1.61
    ],
    "target": [
      0,
      9,
      1.61
    ],
    "focalLengthMm": 24,
    "sensorWidthMm": 36,
    "projection": "perspective",
    "sceneVariant": "open",
    "orthoScale": null,
    "shiftY": 0
  },
  "02_entry_04": {
    "position": [
      2.25,
      4.68,
      1.61
    ],
    "target": [
      1.38,
      11.6,
      1.61
    ],
    "focalLengthMm": 24,
    "sensorWidthMm": 36,
    "projection": "perspective",
    "sceneVariant": "open",
    "orthoScale": null,
    "shiftY": 0
  },
  "03_aerial": {
    "position": [
      17,
      -13,
      36
    ],
    "target": [
      0,
      9.55,
      0
    ],
    "focalLengthMm": null,
    "sensorWidthMm": 36,
    "projection": "orthographic",
    "sceneVariant": "ortho",
    "orthoScale": 31.5,
    "shiftY": 0.035
  },
  "04_showroom_north": {
    "position": [
      0,
      1.28,
      1.61
    ],
    "target": [
      0,
      9,
      1.61
    ],
    "focalLengthMm": 22,
    "sensorWidthMm": 36,
    "projection": "perspective",
    "sceneVariant": "day",
    "orthoScale": null,
    "shiftY": 0
  },
  "04_showroom_south": {
    "position": [
      0,
      12.18,
      1.61
    ],
    "target": [
      0,
      1,
      1.61
    ],
    "focalLengthMm": 22,
    "sensorWidthMm": 36,
    "projection": "perspective",
    "sceneVariant": "day",
    "orthoScale": null,
    "shiftY": 0
  },
  "04_showroom_west": {
    "position": [
      3.85,
      6.8,
      1.61
    ],
    "target": [
      -5.35,
      6.8,
      1.61
    ],
    "focalLengthMm": 24,
    "sensorWidthMm": 36,
    "projection": "perspective",
    "sceneVariant": "day",
    "orthoScale": null,
    "shiftY": 0
  },
  "04_showroom_east": {
    "position": [
      -3.85,
      6.8,
      1.61
    ],
    "target": [
      5.35,
      6.8,
      1.61
    ],
    "focalLengthMm": 24,
    "sensorWidthMm": 36,
    "projection": "perspective",
    "sceneVariant": "day",
    "orthoScale": null,
    "shiftY": 0
  },
  "05_fitting_front": {
    "position": [
      -4,
      13.42,
      1.52
    ],
    "target": [
      -4,
      18.82,
      1.52
    ],
    "focalLengthMm": 25,
    "sensorWidthMm": 36,
    "projection": "perspective",
    "sceneVariant": "day",
    "orthoScale": null,
    "shiftY": 0
  },
  "05_fitting_side": {
    "position": [
      -2.22,
      15.84,
      1.48
    ],
    "target": [
      -5.56,
      16.24,
      1.48
    ],
    "focalLengthMm": 20,
    "sensorWidthMm": 36,
    "projection": "perspective",
    "sceneVariant": "day",
    "orthoScale": null,
    "shiftY": 0
  },
  "06_bar_wide": {
    "position": [
      2.42,
      6.95,
      1.53
    ],
    "target": [
      4.89,
      10.51,
      1.43
    ],
    "focalLengthMm": 25,
    "sensorWidthMm": 36,
    "projection": "perspective",
    "sceneVariant": "day",
    "orthoScale": null,
    "shiftY": 0
  },
  "06_bar_detail": {
    "position": [
      3.76,
      9.03,
      1.22
    ],
    "target": [
      4.51,
      9.68,
      1.05
    ],
    "focalLengthMm": 52,
    "sensorWidthMm": 36,
    "projection": "perspective",
    "sceneVariant": "day",
    "orthoScale": null,
    "shiftY": 0
  },
  "07_style_consult": {
    "position": [
      0,
      13.31,
      1.58
    ],
    "target": [
      0,
      17.5,
      1.45
    ],
    "focalLengthMm": 22,
    "sensorWidthMm": 36,
    "projection": "perspective",
    "sceneVariant": "day",
    "orthoScale": null,
    "shiftY": 0
  },
  "08_ootd_studio": {
    "position": [
      3.18,
      13.65,
      1.58
    ],
    "target": [
      4.2,
      17.4,
      1.43
    ],
    "focalLengthMm": 22,
    "sensorWidthMm": 36,
    "projection": "perspective",
    "sceneVariant": "day",
    "orthoScale": null,
    "shiftY": 0
  }
};
export const ENTRY_KEYS = [
  {
    "progress": 0,
    "cameraId": "02_entry_01",
    "doorState": "closed"
  },
  {
    "progress": 0.32,
    "cameraId": "02_entry_02",
    "doorState": "open"
  },
  {
    "progress": 0.64,
    "cameraId": "02_entry_03",
    "doorState": "open"
  },
  {
    "progress": 1,
    "cameraId": "02_entry_04",
    "doorState": "open"
  }
];
