package com.devs.accountant.account;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AccountRepository extends JpaRepository<Account, Long>, JpaSpecificationExecutor<Account> {

    @EntityGraph(attributePaths = {"currency", "parent"})
    Optional<Account> findByIdAndUserId(Long id, Long userId);

    @EntityGraph(attributePaths = {"currency", "parent"})
    List<Account> findByUserIdAndStatusAndTypeNotOrderByTypeAscNameAsc(
            Long userId, AccountStatus status, AccountType excluded);

    @EntityGraph(attributePaths = {"currency", "parent"})
    List<Account> findByUserIdAndStatusAndIncludeInBalanceTrueAndBalanceGreaterThanAndTypeNotInOrderByNameAsc(
            Long userId, AccountStatus status, BigDecimal minBalance, Collection<AccountType> excluded);

    @EntityGraph(attributePaths = {"currency", "parent"})
    List<Account> findByUserIdAndStatusNotAndTypeInOrderByNameAsc(
            Long userId, AccountStatus excluded, Collection<AccountType> types);

    boolean existsByUserIdAndNameIgnoreCaseAndTypeAndStatusNotAndIdNot(
            Long userId, String name, AccountType type, AccountStatus excluded, Long id);

    boolean existsByParentIdAndStatusNot(Long parentId, AccountStatus excluded);

    @Query("select distinct a.type from Account a where a.parent.id = :parentId and a.status <> :excluded")
    Set<AccountType> findChildTypes(@Param("parentId") Long parentId, @Param("excluded") AccountStatus excluded);

    /** The account and all its descendants (children, grandchildren...). UNION also stops on corrupt cycles. */
    @Query(value = """
                    WITH RECURSIVE subtree AS (
                        SELECT id FROM accounts WHERE id = :id
                        UNION
                        SELECT a.id FROM accounts a JOIN subtree s ON a.parent_account_id = s.id
                    )
                    SELECT id FROM subtree
                    """, nativeQuery = true)
    Set<Long> findSubtreeIds(@Param("id") Long id);

    @Query(value = """
                    SELECT EXISTS (
                        SELECT 1 FROM transactions
                        WHERE origin_account_id = :id OR destination_account_id = :id)
                    """, nativeQuery = true)
    boolean hasTransactions(@Param("id") Long id);

    /** Date of the last persisted transaction of each account of the user. */
    @Query(value = """
                    SELECT account_id AS accountId, MAX(operation_date) AS lastOperationDate FROM (
                        SELECT origin_account_id AS account_id, operation_date FROM transactions WHERE user_id = :userId
                        UNION ALL
                        SELECT destination_account_id, operation_date FROM transactions
                        WHERE user_id = :userId AND destination_account_id IS NOT NULL
                    ) t
                    GROUP BY account_id
                    """, nativeQuery = true)
    List<LastOperation> findLastOperationDates(@Param("userId") Long userId);

    interface LastOperation {
        Long getAccountId();

        LocalDateTime getLastOperationDate();
    }
}
