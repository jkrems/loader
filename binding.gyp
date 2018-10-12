{
  "targets": [
    {
      "target_name": "loader",
      "sources": [
        "src/loader.cc",
        "src/loader_addon.cc",
        "src/module_wrap.cc",
      ],
      "include_dirs" : [
        "<!(node -e \"require('nan')\")",
      ],
      "conditions": [
        [
          '"<!(echo $V)" != "1"',
          {
            "cflags": [
              "-Wno-deprecated-declarations",
            ],
            "xcode_settings": {
              "OTHER_CFLAGS": [
                "-Wno-deprecated-declarations",
              ],
            },
          },
        ],
      ],
    }
  ]
}
