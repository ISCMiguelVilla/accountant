package com.devs.accountant.transaction;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TransactionRepository extends JpaRepository<Transaction, Long>, JpaSpecificationExecutor<Transaction> {

    @EntityGraph(attributePaths = {"origin", "origin.currency", "destination"})
    Optional<Transaction> findByIdAndUserId(Long id, Long userId);

    @Query("select t.uuid from Transaction t where t.uuid in :uuids")
    List<UUID> findExistingUuids(@Param("uuids") Collection<UUID> uuids);
}
