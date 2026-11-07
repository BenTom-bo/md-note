; MDNote NSIS installer hooks
; Included at the top of installer.nsi; variables and functions are global.
; The custom "component selection" page is declared in nsis/installer.nsi.

!include nsDialogs.nsh

Var CompDlg
Var CbCore
Var CbFileAssoc
Var CbContext
Var CbAutostart
Var CbGfm
Var CbHighlight
Var CbKatex
Var CbMermaid
Var CbToc

Var CompInitialized
Var CompCore
Var CompFileAssoc
Var CompContext
Var CompAutostart
Var CompGfm
Var CompHighlight
Var CompKatex
Var CompMermaid
Var CompToc
Var CompFootnotes
Var CompPasteImage

; 静默 / 被动安装没有组件页，使用这些默认值
Function MDNoteSetDefaults
  ${If} $CompInitialized == 1
    Return
  ${EndIf}
  StrCpy $CompCore 1
  StrCpy $CompFileAssoc 1
  StrCpy $CompContext 1
  StrCpy $CompAutostart 0
  StrCpy $CompGfm 1
  StrCpy $CompHighlight 1
  StrCpy $CompKatex 1
  StrCpy $CompMermaid 1
  StrCpy $CompToc 1
  StrCpy $CompFootnotes 1
  StrCpy $CompPasteImage 1
  StrCpy $CompInitialized 1
FunctionEnd

Function MDNoteComponentsPage
  IfSilent MDNoteSkipPage 0
  Call MDNoteSetDefaults
  nsDialogs::Create 1018
  Pop $CompDlg
  ${If} $CompDlg == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 4u 0 290u 18u "请选择本次安装启用的功能组件（安装后可在 设置 - 组件 中修改）"
  Pop $0
  ${NSD_CreateLabel} 4u 20u 140u 12u "-- 安装组件 --"
  Pop $0
  ${NSD_CreateLabel} 152u 20u 140u 12u "-- 渲染增强（按需加载）--"
  Pop $0

  ${NSD_CreateCheckbox} 4u 36u 140u 12u "核心编辑器（必选）"
  Pop $CbCore
  ${NSD_CreateCheckbox} 4u 50u 140u 12u "文件关联 .md / .markdown"
  Pop $CbFileAssoc
  ${NSD_CreateCheckbox} 4u 64u 140u 12u "右键菜单集成"
  Pop $CbContext
  ${NSD_CreateCheckbox} 4u 78u 140u 12u "开机自启"
  Pop $CbAutostart

  ${NSD_CreateCheckbox} 152u 36u 140u 12u "GFM 扩展"
  Pop $CbGfm
  ${NSD_CreateCheckbox} 152u 50u 140u 12u "highlight.js 代码高亮"
  Pop $CbHighlight
  ${NSD_CreateCheckbox} 152u 64u 140u 12u "KaTeX 数学公式"
  Pop $CbKatex
  ${NSD_CreateCheckbox} 152u 78u 140u 12u "Mermaid 图表"
  Pop $CbMermaid
  ${NSD_CreateCheckbox} 152u 92u 140u 12u "TOC / 脚注 / 图片粘贴"
  Pop $CbToc

  ${NSD_Check} $CbCore
  EnableWindow $CbCore 0

  ${If} $CompFileAssoc == 1
    ${NSD_Check} $CbFileAssoc
  ${Else}
    ${NSD_Uncheck} $CbFileAssoc
  ${EndIf}
  ${If} $CompContext == 1
    ${NSD_Check} $CbContext
  ${Else}
    ${NSD_Uncheck} $CbContext
  ${EndIf}
  ${If} $CompAutostart == 1
    ${NSD_Check} $CbAutostart
  ${Else}
    ${NSD_Uncheck} $CbAutostart
  ${EndIf}
  ${If} $CompGfm == 1
    ${NSD_Check} $CbGfm
  ${Else}
    ${NSD_Uncheck} $CbGfm
  ${EndIf}
  ${If} $CompHighlight == 1
    ${NSD_Check} $CbHighlight
  ${Else}
    ${NSD_Uncheck} $CbHighlight
  ${EndIf}
  ${If} $CompKatex == 1
    ${NSD_Check} $CbKatex
  ${Else}
    ${NSD_Uncheck} $CbKatex
  ${EndIf}
  ${If} $CompMermaid == 1
    ${NSD_Check} $CbMermaid
  ${Else}
    ${NSD_Uncheck} $CbMermaid
  ${EndIf}
  ${If} $CompToc == 1
    ${NSD_Check} $CbToc
  ${Else}
    ${NSD_Uncheck} $CbToc
  ${EndIf}

  nsDialogs::Show
  Return

  MDNoteSkipPage:
  Call MDNoteSetDefaults
  Abort
FunctionEnd

Function MDNoteComponentsPageLeave
  ${NSD_GetState} $CbFileAssoc $CompFileAssoc
  ${NSD_GetState} $CbContext $CompContext
  ${NSD_GetState} $CbAutostart $CompAutostart
  ${NSD_GetState} $CbGfm $CompGfm
  ${NSD_GetState} $CbHighlight $CompHighlight
  ${NSD_GetState} $CbKatex $CompKatex
  ${NSD_GetState} $CbMermaid $CompMermaid
  ${NSD_GetState} $CbToc $CompToc
  StrCpy $CompFootnotes $CompToc
  StrCpy $CompPasteImage $CompToc
  StrCpy $CompCore 1
  StrCpy $CompInitialized 1
FunctionEnd

!macro NSIS_HOOK_PREINSTALL
  Call MDNoteSetDefaults
!macroend

!macro NSIS_HOOK_POSTINSTALL
  ; 用户勾选结果写入 components.ini，应用启动时读取
  FileOpen $9 "$INSTDIR\components.ini" w
  ${If} $9 != ""
    FileWrite $9 "core=1$\r$\n"
    FileWrite $9 "fileAssociation=$CompFileAssoc$\r$\n"
    FileWrite $9 "contextMenu=$CompContext$\r$\n"
    FileWrite $9 "autostart=$CompAutostart$\r$\n"
    FileWrite $9 "gfm=$CompGfm$\r$\n"
    FileWrite $9 "highlight=$CompHighlight$\r$\n"
    FileWrite $9 "katex=$CompKatex$\r$\n"
    FileWrite $9 "mermaid=$CompMermaid$\r$\n"
    FileWrite $9 "toc=$CompToc$\r$\n"
    FileWrite $9 "footnotes=$CompFootnotes$\r$\n"
    FileWrite $9 "pasteImage=$CompPasteImage$\r$\n"
    FileClose $9
  ${EndIf}

  ; 右键菜单集成（HKCU）
  ${If} $CompContext == 1
    WriteRegStr HKCU "Software\Classes\*\shell\MDNote.Open" "" "用 MDNote 打开"
    WriteRegStr HKCU "Software\Classes\*\shell\MDNote.Open" "Icon" "$\"$INSTDIR\mdnote.exe$\",0"
    WriteRegStr HKCU "Software\Classes\*\shell\MDNote.Open\command" "" "$\"$INSTDIR\mdnote.exe$\" $\"%1$\""
  ${Else}
    DeleteRegKey HKCU "Software\Classes\*\shell\MDNote.Open"
  ${EndIf}

  ; 开机自启（HKCU Run）
  ${If} $CompAutostart == 1
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "MDNote" "$\"$INSTDIR\mdnote.exe$\""
  ${Else}
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "MDNote"
  ${EndIf}
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  DeleteRegKey HKCU "Software\Classes\*\shell\MDNote.Open"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "MDNote"
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  Delete "$INSTDIR\components.ini"
!macroend
