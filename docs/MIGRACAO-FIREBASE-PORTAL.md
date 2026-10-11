# Migração segura do portal Arena BDA para Firestore

## Estado
O portal `index.html` ainda utiliza `localStorage`. A coleção `portalChampionships` foi adicionada a `firestore.rules`, mas **não foi implantada** e o frontend **não foi conectado**. Não publicar a interface como sincronizada antes de concluir as etapas abaixo.

## Pré-requisitos
1. Confirmar qual projeto Firebase atende ao domínio `arenabda.com.br` e recuperar sua configuração pública no console.
2. Habilitar Firebase Authentication para administradores e confirmar as identidades autorizadas pelas regras.
3. Implantar e testar as regras do Firestore no projeto correto. Testar leitura anônima, escrita anônima negada, escrita de usuário comum negada, escrita de administrador autorizada e exclusão negada.
4. Em **cada navegador que contenha placares relevantes**, abrir a versão com o botão **Exportar backup** e salvar o JSON antes de migrar. O armazenamento local de um dispositivo não contém necessariamente as alterações de outro.
5. Conferir manualmente divergências entre backups, resultados e rodadas; definir uma fonte oficial antes da importação.

## Estrutura proposta
Coleção: `portalChampionships`; documento: identificador da competição (por exemplo, `liga-a`).
Campos permitidos: `id`, `name`, `participants`, `results`, `schemaVersion: 1`, `updatedAt: serverTimestamp()`.

## Cuidados de implantação
- Não importar automaticamente os seeds do HTML por cima de dados existentes.
- Não usar credenciais de administrador no JavaScript público.
- Não conceder escrita pública no Firestore.
- Fazer importação autenticada e idempotente após conciliar os backups.
- Ler dados remotos e tratar estados de carregamento, erros e ausência de conexão.
- Bloquear edição na interface para não administradores **e** aplicar a regra no servidor.
- Validar o fluxo em dois dispositivos antes de mesclar o PR.
- Manter rollback e cópias locais até confirmação da migração.

## Testes mínimos
- Liga A e Liga B com rodadas intactas.
- Empate 0 × 0 válido; placar vazio não é zero.
- Usuário anônimo não altera resultados, mesmo pelo console do navegador.
- Alteração de administrador aparece em outro dispositivo.
- Falha de rede não confirma publicação.
- Nenhum dado existente é sobrescrito durante a primeira sincronização.
