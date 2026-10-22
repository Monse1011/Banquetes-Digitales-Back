// Lectura, guardado y generación comparten el bloqueo de la solicitud en PostgreSQL.
// Así no se leen cantidades de un guardado que todavía no terminó.
async function withAgreementsLock(repository, transactionManager, requestId, work) {
  if (!transactionManager) return work(null);
  return transactionManager.run(async (transaction) => {
    if (transaction.connection) await repository.lockRequest(requestId, transaction);
    return work(transaction);
  });
}

module.exports = { withAgreementsLock };
