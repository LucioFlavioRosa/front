// Configuração de RUNTIME. Este arquivo é servido junto com o site e lido antes
// do app subir — por isso pode mudar por ambiente sem reconstruir a imagem.
//
// Em Kubernetes, um ConfigMap é montado por cima deste arquivo (ver
// deploy/k8s/configmap.yaml e deploy/README.md). O que está aqui é só o padrão
// de desenvolvimento: campos vazios fazem o app cair no default do código
// (/api) e manter o SSO desligado, que é o modo com MSW.
//
// NÃO coloque segredo aqui: este arquivo é público, servido ao navegador.
window.__CADASTRO_CONFIG__ = {
  apiUrl: '',
  sso: {
    authority: '',
    clientId: '',
    escopos: [],
  },
}
