package com.devs.accountant.credit;

import com.devs.accountant.account.AccountStatus;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CreditRepository extends JpaRepository<Credit, Long> {

    Optional<Credit> findByAccountId(Long accountId);

    List<Credit> findByAccountIdIn(Collection<Long> accountIds);

    boolean existsByAccountId(Long accountId);

    /** Credits with a stored date already in the past. */
    @Query("select c from Credit c where c.cutOffDay < :today or c.paymentDueDay < :today")
    List<Credit> findStale(@Param("today") LocalDate today);

    /** Credits of the user's live (not deleted) accounts, with the account loaded. */
    @Query("select c from Credit c join fetch c.account a where a.userId = :userId and a.status <> :deleted")
    List<Credit> findLiveOfUser(@Param("userId") Long userId, @Param("deleted") AccountStatus deleted);
}
