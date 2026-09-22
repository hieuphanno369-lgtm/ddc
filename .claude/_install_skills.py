# -*- coding: utf-8 -*-
import os, shutil

SRC = r"D:/_project/DDC_Control_Tower/.claude/_skills_src"
TGT = r"D:/_project/DDC_Control_Tower/.claude/skills"
os.makedirs(TGT, exist_ok=True)

manifest = []  # (final_name, source_repo, note)

def has_skill(d):
    return os.path.isfile(os.path.join(d, "SKILL.md"))

def copy_skill(src_dir, name, repo, note=""):
    final = name
    dst = os.path.join(TGT, final)
    if os.path.exists(dst):
        final = f"{repo}__{name}"
        dst = os.path.join(TGT, final)
    shutil.copytree(src_dir, dst, dirs_exist_ok=True, ignore=shutil.ignore_patterns('.git', '__pycache__'))
    manifest.append((final, repo, note))
    return final

def copy_dir_of_skills(base, repo, note=""):
    """copy every subdir of base that contains SKILL.md"""
    n = 0
    for name in sorted(os.listdir(base)):
        d = os.path.join(base, name)
        if os.path.isdir(d) and has_skill(d):
            copy_skill(d, name, repo, note)
            n += 1
    return n

# 1. superpowers (pure skills)
n1 = copy_dir_of_skills(os.path.join(SRC, "superpowers", "skills"), "superpowers")

# 2. frontend-design (single)
fd = os.path.join(SRC, "claude-code", "plugins", "frontend-design", "skills", "frontend-design")
copy_skill(fd, "frontend-design", "claude-code")

# 3. code-review-skill (single, root-level files)
cr_src = os.path.join(SRC, "code-review-skill")
cr_dst = os.path.join(TGT, "code-review")
os.makedirs(cr_dst, exist_ok=True)
for item in ["SKILL.md", "reference", "scripts", "assets"]:
    p = os.path.join(cr_src, item)
    if os.path.exists(p):
        shutil.copytree(p, os.path.join(cr_dst, item), dirs_exist_ok=True, ignore=shutil.ignore_patterns('.git')) if os.path.isdir(p) else shutil.copy2(p, os.path.join(cr_dst, item))
manifest.append(("code-review", "awesome-skills/code-review-skill", ""))

# 4. ui-ux-pro-max-skill
n4 = copy_dir_of_skills(os.path.join(SRC, "ui-ux-pro-max-skill", ".claude", "skills"), "ui-ux-pro-max")

# 5. ponytail
n5 = copy_dir_of_skills(os.path.join(SRC, "ponytail", "skills"), "ponytail")

# 6. strix
n6 = copy_dir_of_skills(os.path.join(SRC, "strix", "skills"), "strix", "needs strix CLI (pip/docker)")

# 7. gstack (top-level dirs w/ SKILL.md)
gs = os.path.join(SRC, "gstack")
n7 = 0
for name in sorted(os.listdir(gs)):
    d = os.path.join(gs, name)
    if os.path.isdir(d) and has_skill(d):
        copy_skill(d, name, "gstack")
        n7 += 1

# 8. everything-claude-code
n8 = copy_dir_of_skills(os.path.join(SRC, "everything-claude-code", "skills"), "everything")

# 9. claude-mem (Claude Code plugin skills)
n9 = copy_dir_of_skills(os.path.join(SRC, "claude-mem", "plugin", "skills"), "claude-mem", "needs claude-mem bun CLI")

# 10. graphify — check for a Claude skill
gf = os.path.join(SRC, "graphify", "graphify")
claude_skill = None
for f in os.listdir(gf):
    if f.startswith("skill-") and "claude" in f.lower():
        claude_skill = os.path.join(gf, f)
        break
n10 = 0
if claude_skill:
    d = os.path.join(TGT, "graphify"); os.makedirs(d, exist_ok=True)
    shutil.copy2(claude_skill, os.path.join(d, "SKILL.md"))
    manifest.append(("graphify", "Graphify-Labs/graphify", "needs graphify CLI"))
    n10 = 1

# 11. caveman
n11 = copy_dir_of_skills(os.path.join(SRC, "caveman", "skills"), "caveman", "needs caveman CLI")

# 12. rtk
n12 = copy_dir_of_skills(os.path.join(SRC, "rtk", ".claude", "skills"), "rtk", "needs rtk binary")

# write manifest
with open(os.path.join(TGT, "README.md"), "w", encoding="utf-8") as f:
    f.write("# Installed Skills\n\n")
    f.write("Auto-installed from GitHub on 2026-09-16. Each folder = one Claude Code skill (SKILL.md).\n\n")
    f.write("| Skill | Source repo | Note |\n|---|---|---|\n")
    for name, repo, note in sorted(manifest):
        f.write(f"| `{name}` | {repo} | {note} |\n")

print("superpowers:", n1)
print("frontend-design: 1")
print("code-review: 1")
print("ui-ux-pro-max:", n4)
print("ponytail:", n5)
print("strix:", n6)
print("gstack:", n7)
print("everything-claude-code:", n8)
print("claude-mem:", n9)
print("graphify:", n10)
print("caveman:", n11)
print("rtk:", n12)
print("TOTAL:", len(manifest))
print("\nInstalled skills:")
for name, repo, note in sorted(manifest):
    suffix = f"  [{note}]" if note else ""
    print(f"  - {name}  ({repo}){suffix}")

# ---- Verify CLI deps (report only, không tự cài) ----
import shutil as _sh
CLI_DEPS = {
    "claude-mem": "bun",
    "graphify": "graphify",
    "strix": "strix",
    "caveman": "caveman",
    "rtk": "rtk",
}
print("\nCLI deps:")
for skill, cli in sorted(CLI_DEPS.items()):
    ok = _sh.which(cli) is not None
    print(f"  [{('OK' if ok else 'MISSING')}] {skill} -> {cli}")

