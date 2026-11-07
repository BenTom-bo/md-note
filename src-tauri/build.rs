fn main() {
    // 图标变化时强制重跑 build script，否则 Windows 资源 (.res) 会被 Cargo 缓存，
    // 出现「icons/ 换了但 exe 内嵌图标仍是旧的」的问题。
    println!("cargo:rerun-if-changed=icons/icon.ico");
    println!("cargo:rerun-if-changed=icons/32x32.png");
    tauri_build::build()
}
