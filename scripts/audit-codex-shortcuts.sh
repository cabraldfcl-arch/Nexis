#!/usr/bin/env bash
set -u

# Safe Codex shortcut audit for NEXIS.
# This script reports only presence/status. It never prints auth.json, sessions,
# cookies, tokens, or full alias bodies.

profiles=(
  "codex:/home/u/.codex"
  "codex-tulio:/home/u/.codex-contas/tulio"
  "codex-marina:/home/u/.codex-contas/marina"
  "codex-thiago:/home/u/.codex-contas/thiago"
  "codex-mae:/home/u/.codex-contas/mae"
  "codex-diego:/home/u/.codex-contas/diego"
)

shortcuts=(
  "codex"
  "codex-tulio"
  "codex-marina"
  "codex-thiago"
  "codex-thaigo"
  "codex-mae"
  "coex-mae"
  "codex-diego"
)

nexis_skills=(
  "nexis-finance-ai-engineering"
  "nexis-mobile-frontend"
  "nexis-project-documentation"
  "nexis-quality-gates"
)

official_skills=(
  "playwright"
  "playwright-interactive"
  "screenshot"
  "security-best-practices"
  "security-threat-model"
  "vercel-deploy"
)

shortcut_kind() {
  local name="$1"
  bash -lic "type -t '$name' 2>/dev/null || true" 2>/dev/null
}

shortcut_home() {
  local name="$1"
  bash -lic '
    name="$1"
    kind=$(type -t "$name" 2>/dev/null || true)
    def=""
    if [ "$kind" = alias ]; then
      def=$(alias "$name" 2>/dev/null)
    elif [ "$kind" = function ]; then
      def=$(declare -f "$name" 2>/dev/null)
    fi
    home=$(printf "%s\n" "$def" | grep -oE "CODEX_HOME=\"?[^[:space:];]+" | head -n1 | cut -d= -f2- | tr -d "\"")
    [ -z "$home" ] && [ "$name" = codex ] && home="${CODEX_HOME:-/home/u/.codex}"
    printf "%s\n" "${home:-unknown}"
  ' _ "$name" 2>/dev/null
}

shortcut_compat_target() {
  local name="$1"
  bash -lic '
    name="$1"
    kind=$(type -t "$name" 2>/dev/null || true)
    [ "$kind" = alias ] || exit 0
    def=$(alias "$name" 2>/dev/null)
    if [ "$name" = "codex-thaigo" ] && printf "%s" "$def" | grep -q "codex-thiago"; then
      printf "codex-thiago\n"
    elif [ "$name" = "coex-mae" ] && printf "%s" "$def" | grep -q "codex-mae"; then
      printf "codex-mae\n"
    else
      printf "none\n"
    fi
  ' _ "$name" 2>/dev/null
}

has_skill() {
  local home="$1"
  local skill="$2"
  [ -d "$home/skills/$skill" ]
}

skills_status() {
  local home="$1"
  shift
  local missing=()
  local skill
  for skill in "$@"; do
    has_skill "$home" "$skill" || missing+=("$skill")
  done
  if [ "${#missing[@]}" -eq 0 ]; then
    printf "ok"
  else
    local IFS=,
    printf "missing:%s" "${missing[*]}"
  fi
}

mcp_status() {
  local home="$1"
  local names
  names=$(CODEX_HOME="$home" codex mcp list 2>/dev/null | awk 'NR>1 {print $1}' | sort | paste -sd, -)
  case ",$names," in
    *,codebase-memory-mcp,*playwright,*|*,playwright,*codebase-memory-mcp,*) printf "ok:%s" "$names" ;;
    *) printf "incomplete:%s" "${names:-none}" ;;
  esac
}

feature_status() {
  local home="$1"
  CODEX_HOME="$home" codex features list 2>/dev/null |
    awk '$1=="memories"||$1=="multi_agent"{print $1"="$3}' |
    paste -sd, -
}

trusted_status() {
  local home="$1"
  local config="$home/config.toml"
  if [ -f "$config" ] && grep -q 'PROJETO - NEXT' "$config" && grep -q 'trusted' "$config"; then
    printf "yes"
  else
    printf "no"
  fi
}

auth_status() {
  local home="$1"
  if [ -f "$home/auth.json" ]; then
    printf "present"
  else
    printf "absent"
  fi
}

sessions_status() {
  local home="$1"
  if [ -d "$home/sessions" ]; then
    printf "present"
  else
    printf "absent"
  fi
}

classify_profile() {
  local name="$1"
  local home="$2"
  local kind auth sessions mcp nexis
  kind=$(shortcut_kind "$name")
  auth=$(auth_status "$home")
  sessions=$(sessions_status "$home")
  mcp=$(mcp_status "$home")
  nexis=$(skills_status "$home" "${nexis_skills[@]}")

  if [ -z "$kind" ]; then
    printf "AUSENTE"
  elif [ ! -d "$home" ] || [ ! -f "$home/config.toml" ]; then
    printf "RISCO"
  elif [ "$auth" != present ] || [ "$sessions" != present ]; then
    printf "PENDENTE_LOGIN"
  else
    case "$mcp" in
      ok:*)
        if [ "$nexis" = ok ]; then
          printf "PRONTO"
        else
          printf "RISCO"
        fi
        ;;
      *) printf "RISCO" ;;
    esac
  fi
}

printf "NEXIS Codex shortcuts audit\n"
printf "cwd=%s\n" "$(pwd -P)"
printf "\nShortcuts\n"
for name in "${shortcuts[@]}"; do
  kind=$(shortcut_kind "$name")
  home=$(shortcut_home "$name")
  compat=$(shortcut_compat_target "$name")
  if [ "$name" = "codex-thaigo" ] || [ "$name" = "coex-mae" ]; then
    status="COMPATIBILIDADE"
  elif [ -z "$kind" ]; then
    status="AUSENTE"
  else
    status="ATALHO"
  fi
  printf "%s\tstatus=%s\tkind=%s\thome=%s\tcompat=%s\n" "$name" "$status" "${kind:-missing}" "$home" "${compat:-none}"
done

printf "\nProfiles\n"
for item in "${profiles[@]}"; do
  name=${item%%:*}
  home=${item#*:}
  printf "%s\tclass=%s\thome=%s\tdir=%s\tconfig=%s\tauth=%s\tsessions=%s\ttrusted=%s\tfeatures=%s\tmcp=%s\tnexis=%s\tofficial=%s\n" \
    "$name" \
    "$(classify_profile "$name" "$home")" \
    "$home" \
    "$([ -d "$home" ] && printf present || printf absent)" \
    "$([ -f "$home/config.toml" ] && printf present || printf absent)" \
    "$(auth_status "$home")" \
    "$(sessions_status "$home")" \
    "$(trusted_status "$home")" \
    "$(feature_status "$home")" \
    "$(mcp_status "$home")" \
    "$(skills_status "$home" "${nexis_skills[@]}")" \
    "$(skills_status "$home" "${official_skills[@]}")"
done
