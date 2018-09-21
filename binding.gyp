{
  "targets": [
    {
      "target_name": "loader",
      "sources": [ "src/loader_addon.cc" ],
      "include_dirs" : [
        "<!(node -e \"require('nan')\")",
      ],
    }
  ]
}
