#!/usr/bin/env bash
# Corre tudo por ordem, como o CI (útil localmente). Não corre como root.
d="$(dirname "$0")"
bash "$d/iniciar.sh" && bash "$d/seguranca.sh" && bash "$d/concorrencia.sh" && bash "$d/tempo-real.sh"
